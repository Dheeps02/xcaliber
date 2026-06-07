use async_trait::async_trait;
use pnet::datalink::{self, Channel::Ethernet, DataLinkReceiver, DataLinkSender, NetworkInterface};
use pnet::util::MacAddr;
use std::{
    net::Ipv4Addr,
    sync::Mutex,
    time::{Duration, Instant},
};

use super::XcpTransport;
use crate::xcp::{error::XcpError, packet::XcpPacket};

const ETHERTYPE_IPV4: u16 = 0x0800;
const ETHERTYPE_VLAN: u16 = 0x8100;
const IPV4_HEADER_LEN: usize = 20;
const UDP_HEADER_LEN: usize = 8;

pub struct EthernetConfig {
    pub server_ip: String,
    pub server_port: u16,
    pub bind_ip: Option<String>,
    pub source_port: Option<u16>,
    pub src_mac: Option<String>,
    pub dst_mac: String,
    pub vlan_id: Option<u16>,
}

pub struct EthernetTransport {
    tx: Mutex<Box<dyn DataLinkSender>>,
    rx: Mutex<Box<dyn DataLinkReceiver>>,
    src_mac: MacAddr,
    dst_mac: MacAddr,
    src_ip: Ipv4Addr,
    dst_ip: Ipv4Addr,
    src_port: u16,
    dst_port: u16,
    vlan_id: Option<u16>,
}

impl EthernetTransport {
    pub async fn connect(cfg: EthernetConfig) -> Result<Self, XcpError> {
        let dst_ip = parse_ipv4(&cfg.server_ip, "server_ip")?;
        let bind_ip = cfg.bind_ip.as_deref().filter(|s| !s.is_empty());
        let src_ip = match bind_ip {
            Some(ip) => parse_ipv4(ip, "bind_ip")?,
            None => {
                return Err(XcpError::Transport(
                    "Raw Ethernet requires a selected IPv4 interface".into(),
                ));
            }
        };
        let vlan_id = cfg.vlan_id.map(validate_vlan_id).transpose()?;
        let dst_mac = parse_mac(&cfg.dst_mac)?;
        let interface = find_interface(src_ip)?;
        let src_mac = match cfg.src_mac.as_deref().filter(|s| !s.is_empty()) {
            Some(mac) => parse_mac(mac)?,
            None => interface.mac.ok_or_else(|| {
                XcpError::Transport(format!("Interface {} has no MAC address", interface.name))
            })?,
        };
        let src_port = cfg.source_port.unwrap_or(cfg.server_port);

        let mut datalink_cfg = datalink::Config::default();
        datalink_cfg.read_timeout = Some(Duration::from_millis(50));
        let (tx, rx) = match datalink::channel(&interface, datalink_cfg)
            .map_err(|e| XcpError::Transport(e.to_string()))?
        {
            Ethernet(tx, rx) => (tx, rx),
            _ => return Err(XcpError::Transport("Unsupported datalink channel".into())),
        };

        Ok(Self {
            tx: Mutex::new(tx),
            rx: Mutex::new(rx),
            src_mac,
            dst_mac,
            src_ip,
            dst_ip,
            src_port,
            dst_port: cfg.server_port,
            vlan_id,
        })
    }
}

#[async_trait]
impl XcpTransport for EthernetTransport {
    async fn send(&self, packet: &XcpPacket) -> Result<(), XcpError> {
        let frame = build_frame(
            packet,
            self.src_mac,
            self.dst_mac,
            self.src_ip,
            self.dst_ip,
            self.src_port,
            self.dst_port,
            self.vlan_id,
        );
        let mut tx = self
            .tx
            .lock()
            .map_err(|_| XcpError::Transport("Ethernet sender lock poisoned".into()))?;
        tx.send_to(&frame, None)
            .ok_or_else(|| XcpError::Transport("Ethernet sender unavailable".into()))?
            .map_err(|e| XcpError::Transport(e.to_string()))
    }

    async fn recv(&self, timeout_ms: u64) -> Result<XcpPacket, XcpError> {
        let deadline = Instant::now() + Duration::from_millis(timeout_ms);
        loop {
            if Instant::now() >= deadline {
                return Err(XcpError::Timeout);
            }

            let frame = {
                let mut rx = self
                    .rx
                    .lock()
                    .map_err(|_| XcpError::Transport("Ethernet receiver lock poisoned".into()))?;
                match rx.next() {
                    Ok(frame) => frame.to_vec(),
                    Err(_) => continue,
                }
            };

            if let Some(payload) = parse_matching_payload(
                &frame,
                self.src_mac,
                self.dst_mac,
                self.src_ip,
                self.dst_ip,
                self.src_port,
                self.dst_port,
                self.vlan_id,
            ) {
                return XcpPacket::decode(payload);
            }
        }
    }

    async fn close(&self) {}
}

fn parse_ipv4(value: &str, field: &str) -> Result<Ipv4Addr, XcpError> {
    value.parse().map_err(|_| {
        XcpError::Transport(format!("{field} must be an IPv4 address for Raw Ethernet"))
    })
}

fn parse_mac(value: &str) -> Result<MacAddr, XcpError> {
    let parts: Vec<&str> = value.split(':').collect();
    if parts.len() != 6 {
        return Err(XcpError::Transport(
            "MAC address must use XX:XX:XX:XX:XX:XX".into(),
        ));
    }
    let mut bytes = [0u8; 6];
    for (i, part) in parts.iter().enumerate() {
        if part.len() != 2 {
            return Err(XcpError::Transport(
                "MAC address must use XX:XX:XX:XX:XX:XX".into(),
            ));
        }
        bytes[i] = u8::from_str_radix(part, 16)
            .map_err(|_| XcpError::Transport("MAC address contains invalid hex".into()))?;
    }
    Ok(MacAddr::new(
        bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5],
    ))
}

fn validate_vlan_id(id: u16) -> Result<u16, XcpError> {
    if (1..=4094).contains(&id) {
        Ok(id)
    } else {
        Err(XcpError::Transport(
            "vlan_id must be between 1 and 4094".into(),
        ))
    }
}

fn find_interface(src_ip: Ipv4Addr) -> Result<NetworkInterface, XcpError> {
    datalink::interfaces()
        .into_iter()
        .find(|iface| {
            iface.ips.iter().any(|net| match net.ip() {
                std::net::IpAddr::V4(ip) => ip == src_ip,
                std::net::IpAddr::V6(_) => false,
            })
        })
        .ok_or_else(|| XcpError::Transport(format!("No network interface found for {src_ip}")))
}

fn build_frame(
    packet: &XcpPacket,
    src_mac: MacAddr,
    dst_mac: MacAddr,
    src_ip: Ipv4Addr,
    dst_ip: Ipv4Addr,
    src_port: u16,
    dst_port: u16,
    vlan_id: Option<u16>,
) -> Vec<u8> {
    let xcp = packet.encode();
    let ip_total_len = (IPV4_HEADER_LEN + UDP_HEADER_LEN + xcp.len()) as u16;
    let eth_header_len = if vlan_id.is_some() { 18 } else { 14 };
    let mut frame = Vec::with_capacity(eth_header_len + ip_total_len as usize);

    frame.extend_from_slice(&mac_bytes(dst_mac));
    frame.extend_from_slice(&mac_bytes(src_mac));
    if let Some(id) = vlan_id {
        frame.extend_from_slice(&ETHERTYPE_VLAN.to_be_bytes());
        frame.extend_from_slice(&(id & 0x0FFF).to_be_bytes());
    }
    frame.extend_from_slice(&ETHERTYPE_IPV4.to_be_bytes());

    let ip_start = frame.len();
    frame.push(0x45);
    frame.push(0);
    frame.extend_from_slice(&ip_total_len.to_be_bytes());
    frame.extend_from_slice(&0u16.to_be_bytes());
    frame.extend_from_slice(&0x4000u16.to_be_bytes());
    frame.push(64);
    frame.push(17);
    frame.extend_from_slice(&0u16.to_be_bytes());
    frame.extend_from_slice(&src_ip.octets());
    frame.extend_from_slice(&dst_ip.octets());
    let ip_checksum = checksum(&frame[ip_start..ip_start + IPV4_HEADER_LEN]);
    frame[ip_start + 10..ip_start + 12].copy_from_slice(&ip_checksum.to_be_bytes());

    let udp_start = frame.len();
    let udp_len = (UDP_HEADER_LEN + xcp.len()) as u16;
    frame.extend_from_slice(&src_port.to_be_bytes());
    frame.extend_from_slice(&dst_port.to_be_bytes());
    frame.extend_from_slice(&udp_len.to_be_bytes());
    frame.extend_from_slice(&0u16.to_be_bytes());
    frame.extend_from_slice(&xcp);
    let udp_checksum = udp_ipv4_checksum(src_ip, dst_ip, &frame[udp_start..]);
    frame[udp_start + 6..udp_start + 8].copy_from_slice(&udp_checksum.to_be_bytes());

    frame
}

fn parse_matching_payload<'a>(
    frame: &'a [u8],
    local_mac: MacAddr,
    remote_mac: MacAddr,
    local_ip: Ipv4Addr,
    remote_ip: Ipv4Addr,
    local_port: u16,
    remote_port: u16,
    vlan_id: Option<u16>,
) -> Option<&'a [u8]> {
    if frame.len() < 14 {
        return None;
    }
    if frame[0..6] != mac_bytes(local_mac) || frame[6..12] != mac_bytes(remote_mac) {
        return None;
    }

    let mut offset = 12;
    let ethertype = u16::from_be_bytes([frame[offset], frame[offset + 1]]);
    offset += 2;
    if ethertype == ETHERTYPE_VLAN {
        if frame.len() < 18 {
            return None;
        }
        let tci = u16::from_be_bytes([frame[offset], frame[offset + 1]]);
        if Some(tci & 0x0FFF) != vlan_id {
            return None;
        }
        offset += 2;
        let inner = u16::from_be_bytes([frame[offset], frame[offset + 1]]);
        offset += 2;
        if inner != ETHERTYPE_IPV4 {
            return None;
        }
    } else if ethertype != ETHERTYPE_IPV4 || vlan_id.is_some() {
        return None;
    }

    if frame.len() < offset + IPV4_HEADER_LEN {
        return None;
    }
    let ihl = ((frame[offset] & 0x0F) as usize) * 4;
    if ihl < IPV4_HEADER_LEN || frame.len() < offset + ihl {
        return None;
    }
    let total_len = u16::from_be_bytes([frame[offset + 2], frame[offset + 3]]) as usize;
    if frame.len() < offset + total_len || frame[offset + 9] != 17 {
        return None;
    }
    let src_ip = Ipv4Addr::new(
        frame[offset + 12],
        frame[offset + 13],
        frame[offset + 14],
        frame[offset + 15],
    );
    let dst_ip = Ipv4Addr::new(
        frame[offset + 16],
        frame[offset + 17],
        frame[offset + 18],
        frame[offset + 19],
    );
    if src_ip != remote_ip || dst_ip != local_ip {
        return None;
    }

    let udp_start = offset + ihl;
    if frame.len() < udp_start + UDP_HEADER_LEN {
        return None;
    }
    let src_port = u16::from_be_bytes([frame[udp_start], frame[udp_start + 1]]);
    let dst_port = u16::from_be_bytes([frame[udp_start + 2], frame[udp_start + 3]]);
    let udp_len = u16::from_be_bytes([frame[udp_start + 4], frame[udp_start + 5]]) as usize;
    if src_port != remote_port || dst_port != local_port || udp_len < UDP_HEADER_LEN {
        return None;
    }
    let payload_start = udp_start + UDP_HEADER_LEN;
    let payload_end = udp_start + udp_len;
    if frame.len() < payload_end {
        return None;
    }
    Some(&frame[payload_start..payload_end])
}

fn mac_bytes(mac: MacAddr) -> [u8; 6] {
    [mac.0, mac.1, mac.2, mac.3, mac.4, mac.5]
}

fn checksum(bytes: &[u8]) -> u16 {
    let mut sum = ones_complement_sum(bytes);
    while (sum >> 16) != 0 {
        sum = (sum & 0xFFFF) + (sum >> 16);
    }
    !(sum as u16)
}

fn udp_ipv4_checksum(src_ip: Ipv4Addr, dst_ip: Ipv4Addr, udp: &[u8]) -> u16 {
    let mut pseudo = Vec::with_capacity(12 + udp.len() + 1);
    pseudo.extend_from_slice(&src_ip.octets());
    pseudo.extend_from_slice(&dst_ip.octets());
    pseudo.push(0);
    pseudo.push(17);
    pseudo.extend_from_slice(&(udp.len() as u16).to_be_bytes());
    pseudo.extend_from_slice(udp);
    if pseudo.len() % 2 != 0 {
        pseudo.push(0);
    }
    let value = checksum(&pseudo);
    if value == 0 { 0xFFFF } else { value }
}

fn ones_complement_sum(bytes: &[u8]) -> u32 {
    let mut sum = 0u32;
    let mut chunks = bytes.chunks_exact(2);
    for chunk in &mut chunks {
        sum += u16::from_be_bytes([chunk[0], chunk[1]]) as u32;
    }
    if let Some(&last) = chunks.remainder().first() {
        sum += (last as u32) << 8;
    }
    sum
}
