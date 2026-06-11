use async_trait::async_trait;
use pnet::datalink::{self, Channel::Ethernet, DataLinkReceiver, DataLinkSender, NetworkInterface};
use pnet::util::MacAddr;
use std::{
    net::Ipv4Addr,
    sync::Mutex,
    time::{Duration, Instant},
};

use super::XcpTransport;
use crate::debug_log::log as debug_log;
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
    iface_info: String,
}

impl EthernetTransport {
    pub async fn connect(cfg: EthernetConfig) -> Result<Self, XcpError> {
        debug_log("EthernetTransport::connect: start".to_string());
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
        debug_log("EthernetTransport::connect: resolving interface".to_string());
        let interface = find_interface(src_ip)?;
        debug_log(format!(
            "EthernetTransport::connect: interface resolved -> {} [{}]",
            interface.name, interface.description
        ));
        let iface_info = format!(
            "{} [{}] mac={}",
            interface.name,
            interface.description,
            interface
                .mac
                .map(|m| m.to_string())
                .unwrap_or_else(|| "unknown".into())
        );
        let src_mac = match cfg.src_mac.as_deref().filter(|s| !s.is_empty()) {
            Some(mac) => parse_mac(mac)?,
            None => interface.mac.ok_or_else(|| {
                XcpError::Transport(format!("Interface {} has no MAC address", interface.name))
            })?,
        };
        let src_port = cfg.source_port.unwrap_or(cfg.server_port);

        let mut datalink_cfg = datalink::Config::default();
        datalink_cfg.read_timeout = Some(Duration::from_millis(50));
        datalink_cfg.promiscuous = true;
        debug_log("EthernetTransport::connect: opening datalink channel (PacketOpenAdapter + promiscuous mode set)".to_string());
        let (tx, rx) = match datalink::channel(&interface, datalink_cfg)
            .map_err(|e| XcpError::Transport(e.to_string()))?
        {
            Ethernet(tx, rx) => (tx, rx),
            _ => return Err(XcpError::Transport("Unsupported datalink channel".into())),
        };
        debug_log("EthernetTransport::connect: datalink channel opened".to_string());

        debug_log(format!(
            "connect: iface={iface_info} src_mac={src_mac} dst_mac={dst_mac} \
             src={src_ip}:{src_port} dst={dst_ip}:{} vlan={vlan_id:?}",
            cfg.server_port
        ));

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
            iface_info,
        })
    }

    /// Human-readable description of the network interface this transport is
    /// bound to (name, description, MAC), for surfacing in error messages so
    /// users can verify it matches the adapter they expect (e.g. against a
    /// Wireshark capture).
    pub fn iface_info(&self) -> &str {
        &self.iface_info
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
        debug_log(format!(
            "send: {} bytes {}:{} -> {}:{} frame[0..14]={:02X?}",
            frame.len(),
            self.src_ip,
            self.src_port,
            self.dst_ip,
            self.dst_port,
            &frame[..14.min(frame.len())]
        ));
        let mut tx = self
            .tx
            .lock()
            .map_err(|_| XcpError::Transport("Ethernet sender lock poisoned".into()))?;
        let result = tx
            .send_to(&frame, None)
            .ok_or_else(|| XcpError::Transport("Ethernet sender unavailable".into()))?
            .map_err(|e| XcpError::Transport(e.to_string()));
        if let Err(e) = &result {
            debug_log(format!("send: error {e}"));
        }
        result
    }

    async fn recv(&self, timeout_ms: u64) -> Result<XcpPacket, XcpError> {
        let deadline = Instant::now() + Duration::from_millis(timeout_ms);
        let mut frames_seen = 0u32;
        let mut logged_err = false;
        loop {
            if Instant::now() >= deadline {
                debug_log(format!(
                    "recv: timed out after {timeout_ms}ms, frames_seen={frames_seen}"
                ));
                return Err(XcpError::Timeout);
            }

            // `rx.next()` below is a blocking call (Npcap read with a fixed
            // read_timeout), so this async fn never naturally yields. Without
            // an explicit yield here, this task's poll() never returns
            // Pending, which starves other tasks woken via the broadcast
            // channel (e.g. execute_packet) that get parked in this worker's
            // LIFO slot and are never serviced.
            tokio::task::yield_now().await;

            let frame = {
                let mut rx = self
                    .rx
                    .lock()
                    .map_err(|_| XcpError::Transport("Ethernet receiver lock poisoned".into()))?;
                match rx.next() {
                    Ok(frame) => frame.to_vec(),
                    Err(e) => {
                        if !logged_err {
                            debug_log(format!("recv: rx.next() error: {e}"));
                            logged_err = true;
                        }
                        continue;
                    }
                }
            };

            frames_seen += 1;
            let matched = parse_matching_payload(
                &frame,
                self.src_ip,
                self.dst_ip,
                self.src_port,
                self.dst_port,
                self.vlan_id,
            );

            if let Some(payload) = matched {
                match XcpPacket::decode(payload) {
                    Ok(packet) => return Ok(packet),
                    Err(e) => {
                        debug_log(format!("recv: failed to decode UDP payload {payload:02X?}: {e}"));
                        continue;
                    }
                }
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

/// Resolve the configured `bind_ip` to the matching `pnet` datalink interface.
///
/// `pnet::datalink::interfaces()` is unreliable on Windows: adapters can have
/// empty/stale `ips`, and multiple virtual adapters often share overlapping
/// link-local (169.254.x.x) addresses, so matching on IP alone can select the
/// wrong adapter. Instead, resolve `bind_ip` to a MAC address using the
/// `network-interface` crate (the same source that populates the interface
/// dropdown in Settings, so it reflects the adapter the user actually
/// selected), then find the `pnet` interface with that MAC. Fall back to the
/// IP-based match if MAC resolution doesn't find anything.
fn find_interface(src_ip: Ipv4Addr) -> Result<NetworkInterface, XcpError> {
    use network_interface::{Addr, NetworkInterface as NiInterface, NetworkInterfaceConfig};

    debug_log(format!("find_interface: resolving bind_ip={src_ip}"));

    let ni_interfaces = NiInterface::show().unwrap_or_default();
    debug_log("find_interface: NiInterface::show() done".to_string());
    for iface in &ni_interfaces {
        let ips: Vec<String> = iface
            .addr
            .iter()
            .map(|a| match a {
                Addr::V4(v4) => v4.ip.to_string(),
                Addr::V6(v6) => v6.ip.to_string(),
            })
            .collect();
        debug_log(format!(
            "  network-interface: {} mac={} ips=[{}]",
            iface.name,
            iface.mac_addr.as_deref().unwrap_or("unknown"),
            ips.join(", ")
        ));
    }

    let target_mac = ni_interfaces
        .into_iter()
        .find(|iface| {
            iface.addr.iter().any(|addr| match addr {
                Addr::V4(v4) => v4.ip == src_ip,
                Addr::V6(_) => false,
            })
        })
        .and_then(|iface| iface.mac_addr)
        .and_then(|mac| mac.parse::<MacAddr>().ok());
    debug_log(format!("find_interface: target_mac={target_mac:?}"));

    let interfaces = datalink::interfaces();
    debug_log("find_interface: datalink::interfaces() done".to_string());
    for iface in &interfaces {
        let ips: Vec<String> = iface.ips.iter().map(|n| n.ip().to_string()).collect();
        debug_log(format!(
            "  pnet: {} [{}] mac={:?} ips=[{}]",
            iface.name,
            iface.description,
            iface.mac,
            ips.join(", ")
        ));
    }

    if let Some(mac) = target_mac {
        if let Some(iface) = interfaces.iter().find(|iface| iface.mac == Some(mac)) {
            debug_log(format!(
                "find_interface: matched by MAC -> {} [{}]",
                iface.name, iface.description
            ));
            return Ok(iface.clone());
        }
    }

    let by_ip = interfaces.iter().find(|iface| {
        iface.ips.iter().any(|net| match net.ip() {
            std::net::IpAddr::V4(ip) => ip == src_ip,
            std::net::IpAddr::V6(_) => false,
        })
    });
    if let Some(iface) = by_ip {
        debug_log(format!(
            "find_interface: matched by IP -> {} [{}]",
            iface.name, iface.description
        ));
        return Ok(iface.clone());
    }

    let available = interfaces
        .iter()
        .map(|iface| {
            format!(
                "{} [{}] mac={}",
                iface.name,
                iface.description,
                iface
                    .mac
                    .map(|m| m.to_string())
                    .unwrap_or_else(|| "unknown".into())
            )
        })
        .collect::<Vec<_>>()
        .join(", ");
    debug_log("find_interface: no match found".to_string());
    Err(XcpError::Transport(format!(
        "No network interface found for {src_ip}. pnet sees: [{available}]"
    )))
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
    local_ip: Ipv4Addr,
    remote_ip: Ipv4Addr,
    local_port: u16,
    // Some ECUs answer from a dynamically assigned source port even when the
    // command was sent to the configured XCP UDP port, so the response's
    // source port is intentionally not checked against this. The
    // destination IP/port and source IP are the stable tuple for receiving.
    _remote_port: u16,
    vlan_id: Option<u16>,
) -> Option<&'a [u8]> {
    if frame.len() < 14 {
        return None;
    }
    // RX intentionally ignores Ethernet source/destination MAC addresses.
    // Some ECU/switch setups reply with an L2 destination that differs from
    // the configured transmit source MAC; IP/UDP identify the XCP response.
    let mut offset = 12;
    let ethertype = u16::from_be_bytes([frame[offset], frame[offset + 1]]);
    offset += 2;
    if ethertype == ETHERTYPE_VLAN {
        if frame.len() < 18 {
            return None;
        }
        let tci = u16::from_be_bytes([frame[offset], frame[offset + 1]]);
        let frame_vlan_id = tci & 0x0FFF;
        if vlan_id.map_or(frame_vlan_id != 0, |id| frame_vlan_id != id) {
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
    let dst_port = u16::from_be_bytes([frame[udp_start + 2], frame[udp_start + 3]]);
    let udp_len = u16::from_be_bytes([frame[udp_start + 4], frame[udp_start + 5]]) as usize;
    if dst_port != local_port || udp_len < UDP_HEADER_LEN {
        return None;
    }
    if udp_start + udp_len > offset + total_len {
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

#[cfg(test)]
mod tests {
    use super::*;

    fn mac(value: &str) -> MacAddr {
        parse_mac(value).unwrap()
    }

    #[test]
    fn parses_real_captured_connect_response() {
        // Captured response frame (60 bytes incl. padding) from a real ECU,
        // dst MAC differs from configured src_mac (08:be:ac:35:c0:62 vs 02:f0:52:44:00:06).
        let frame: Vec<u8> = vec![
            0x08, 0xbe, 0xac, 0x35, 0xc0, 0x62, // eth dst
            0x02, 0xf0, 0x52, 0x44, 0x00, 0x22, // eth src
            0x08, 0x00, // ethertype IPv4
            0x45, 0x00, 0x00, 0x28, 0xe6, 0x1c, 0x40, 0x00, 0xff, 0x11, 0x81, 0x95,
            10, 2, 0, 3, // src ip
            10, 2, 0, 12, // dst ip
            0xc7, 0x42, 0xc7, 0x42, 0x00, 0x14, 0x42, 0x8f, // udp header
            0x08, 0x00, 0x02, 0x00, 0xff, 0x05, 0x80, 0x96, 0x90, 0x01, 0x01, 0x01, // xcp payload
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // padding
        ];

        let local_ip = Ipv4Addr::new(10, 2, 0, 12);
        let remote_ip = Ipv4Addr::new(10, 2, 0, 3);

        let payload = parse_matching_payload(&frame, local_ip, remote_ip, 51010, 51010, None)
            .expect("frame should match");

        let packet = XcpPacket::decode(payload).unwrap();
        assert_eq!(packet.counter, 2);
        assert_eq!(packet.payload, vec![0xff, 0x05, 0x80, 0x96, 0x90, 0x01, 0x01, 0x01]);
    }

    #[test]
    fn parses_response_for_configured_tuple() {
        let local_mac = mac("02:F0:52:44:00:06");
        let remote_mac = mac("02:F0:52:44:00:22");
        let local_ip = Ipv4Addr::new(10, 2, 0, 12);
        let remote_ip = Ipv4Addr::new(10, 2, 0, 3);
        let packet = XcpPacket::new(0, vec![0xFF, 0x01, 0x00, 0x00, 0xFF, 0xFF, 0x05, 0x01]);
        let frame = build_frame(
            &packet, remote_mac, local_mac, remote_ip, local_ip, 51010, 51010, None,
        );

        let payload = parse_matching_payload(
            &frame, local_ip, remote_ip, 51010, 51010, None,
        )
        .unwrap();

        assert_eq!(XcpPacket::decode(payload).unwrap(), packet);
    }

    #[test]
    fn accepts_response_to_different_destination_mac_when_ip_udp_match() {
        let configured_local_mac = mac("02:F0:52:44:00:06");
        let actual_destination_mac = mac("02:F0:52:44:99:99");
        let remote_mac = mac("02:F0:52:44:00:22");
        let local_ip = Ipv4Addr::new(10, 2, 0, 12);
        let remote_ip = Ipv4Addr::new(10, 2, 0, 3);
        let packet = XcpPacket::new(0, vec![0xFF, 0x00, 0x00, 0x00]);
        let frame = build_frame(
            &packet,
            remote_mac,
            actual_destination_mac,
            remote_ip,
            local_ip,
            51010,
            51010,
            None,
        );

        assert!(
            parse_matching_payload(
                &frame,
                local_ip,
                remote_ip,
                51010,
                51010,
                None,
            )
            .is_some()
        );
    }

    #[test]
    fn accepts_priority_tagged_vlan_zero_when_vlan_is_not_configured() {
        let local_mac = mac("02:F0:52:44:00:06");
        let remote_mac = mac("02:F0:52:44:00:22");
        let local_ip = Ipv4Addr::new(10, 2, 0, 12);
        let remote_ip = Ipv4Addr::new(10, 2, 0, 3);
        let packet = XcpPacket::new(0, vec![0xFF]);
        let frame = build_frame(
            &packet,
            remote_mac,
            local_mac,
            remote_ip,
            local_ip,
            51010,
            51010,
            Some(0),
        );

        assert!(
            parse_matching_payload(
                &frame, local_ip, remote_ip, 51010, 51010, None,
            )
            .is_some()
        );
    }
}
