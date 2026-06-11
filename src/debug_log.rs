use std::sync::OnceLock;
use std::time::Instant;

static START: OnceLock<Instant> = OnceLock::new();

/// Best-effort append a line to `xcaliber-debug.log` next to the executable.
///
/// Packaged Windows builds run with `windows_subsystem = "windows"` (no
/// console), so `eprintln!`/`println!` aren't visible to users. A log file
/// next to the exe lets users capture diagnostics and share them with us.
///
/// Each line is prefixed with seconds elapsed since process start, so gaps
/// between steps (e.g. a slow `connect()`) are visible directly in the log.
pub fn log(msg: impl AsRef<str>) {
    use std::io::Write;
    let elapsed = START.get_or_init(Instant::now).elapsed();
    let path = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("xcaliber-debug.log")))
        .unwrap_or_else(|| std::path::PathBuf::from("xcaliber-debug.log"));
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        // Single write_all call so concurrent writers from different tasks
        // can't interleave a line's content and its trailing newline.
        let line = format!("[{:>9.3}] {}\n", elapsed.as_secs_f64(), msg.as_ref());
        let _ = f.write_all(line.as_bytes());
    }
}
