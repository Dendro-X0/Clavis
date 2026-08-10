//! Desktop foreground probe + SendInput autotype (Windows first).

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ForegroundWindowInfo {
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub process_name: Option<String>,
    /// `windows` | `unsupported`
    pub platform: String,
    pub supported: bool,
}

#[cfg(windows)]
mod win {
    use super::ForegroundWindowInfo;
    use std::time::Duration;
    use windows_sys::Win32::Foundation::{CloseHandle, HWND, MAX_PATH};
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, KEYEVENTF_UNICODE, VK_TAB,
        VK_RETURN,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
    };

    pub fn foreground_window_info() -> Result<ForegroundWindowInfo, String> {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() {
                return Err("no foreground window".into());
            }
            let title = window_title(hwnd)?;
            let process_name = process_name_for_window(hwnd);
            Ok(ForegroundWindowInfo {
                title,
                process_name,
                platform: "windows".into(),
                supported: true,
            })
        }
    }

    unsafe fn window_title(hwnd: HWND) -> Result<String, String> {
        let len = GetWindowTextLengthW(hwnd);
        if len <= 0 {
            return Ok(String::new());
        }
        let mut buf = vec![0u16; (len as usize) + 1];
        let written = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
        if written <= 0 {
            return Ok(String::new());
        }
        Ok(String::from_utf16_lossy(&buf[..written as usize]))
    }

    unsafe fn process_name_for_window(hwnd: HWND) -> Option<String> {
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return None;
        }
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            return None;
        }
        let mut buf = [0u16; MAX_PATH as usize];
        let mut size = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(handle, 0, buf.as_mut_ptr(), &mut size);
        CloseHandle(handle);
        if ok == 0 || size == 0 {
            return None;
        }
        let path = String::from_utf16_lossy(&buf[..size as usize]);
        Some(
            std::path::Path::new(&path)
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or(&path)
                .to_string(),
        )
    }

    pub fn assert_foreground_title(expected: &str) -> Result<(), String> {
        let info = foreground_window_info()?;
        if info.title != expected {
            return Err(format!(
                "foreground changed (expected “{expected}”, got “{}”) — aborted",
                info.title
            ));
        }
        Ok(())
    }

    /// Type Unicode text via SendInput. Optional Tab/Enter helpers for login sequences.
    pub fn type_text(text: &str, inter_key_ms: u64) -> Result<(), String> {
        for ch in text.chars() {
            send_unicode(ch)?;
            if inter_key_ms > 0 {
                std::thread::sleep(Duration::from_millis(inter_key_ms));
            }
        }
        Ok(())
    }

    pub fn type_tab(inter_key_ms: u64) -> Result<(), String> {
        send_vk(VK_TAB as u16)?;
        if inter_key_ms > 0 {
            std::thread::sleep(Duration::from_millis(inter_key_ms));
        }
        Ok(())
    }

    #[allow(dead_code)]
    pub fn type_enter(inter_key_ms: u64) -> Result<(), String> {
        send_vk(VK_RETURN as u16)?;
        if inter_key_ms > 0 {
            std::thread::sleep(Duration::from_millis(inter_key_ms));
        }
        Ok(())
    }

    fn send_unicode(ch: char) -> Result<(), String> {
        let mut buf = [0u16; 2];
        let encoded = ch.encode_utf16(&mut buf);
        for &unit in encoded.iter() {
            unsafe {
                let mut down = INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: std::mem::zeroed(),
                };
                down.Anonymous.ki = KEYBDINPUT {
                    wVk: 0,
                    wScan: unit,
                    dwFlags: KEYEVENTF_UNICODE,
                    time: 0,
                    dwExtraInfo: 0,
                };
                let mut up = down;
                up.Anonymous.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
                let sent = SendInput(2, [down, up].as_mut_ptr(), std::mem::size_of::<INPUT>() as i32);
                if sent != 2 {
                    return Err("SendInput failed".into());
                }
            }
        }
        Ok(())
    }

    fn send_vk(vk: u16) -> Result<(), String> {
        unsafe {
            let mut down = INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: std::mem::zeroed(),
            };
            down.Anonymous.ki = KEYBDINPUT {
                wVk: vk,
                wScan: 0,
                dwFlags: 0,
                time: 0,
                dwExtraInfo: 0,
            };
            let mut up = down;
            up.Anonymous.ki.dwFlags = KEYEVENTF_KEYUP;
            let sent = SendInput(2, [down, up].as_mut_ptr(), std::mem::size_of::<INPUT>() as i32);
            if sent != 2 {
                return Err("SendInput failed".into());
            }
        }
        Ok(())
    }
}

#[cfg(windows)]
pub use win::{
    assert_foreground_title, foreground_window_info, type_tab, type_text,
};

#[cfg(not(windows))]
pub fn foreground_window_info() -> Result<ForegroundWindowInfo, String> {
    Ok(ForegroundWindowInfo {
        title: String::new(),
        process_name: None,
        platform: std::env::consts::OS.into(),
        supported: false,
    })
}

#[cfg(not(windows))]
pub fn assert_foreground_title(_expected: &str) -> Result<(), String> {
    Err("autotype is only available on Windows in v0.12".into())
}

#[cfg(not(windows))]
pub fn type_text(_text: &str, _inter_key_ms: u64) -> Result<(), String> {
    Err("autotype is only available on Windows in v0.12".into())
}

#[cfg(not(windows))]
pub fn type_tab(_inter_key_ms: u64) -> Result<(), String> {
    Err("autotype is only available on Windows in v0.12".into())
}

#[cfg(not(windows))]
pub fn type_enter(_inter_key_ms: u64) -> Result<(), String> {
    Err("autotype is only available on Windows in v0.12".into())
}
