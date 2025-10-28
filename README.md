### ✅ `README.md`

# Student Screen Recorder Extension

A Chrome extension that allows students to record their screens and automatically upload recordings to their GitHub repositories. Perfect for computer labs and educational environments.

---

## 🚀 Features

- 🎥 **Screen Recording**: Record entire screen, specific windows, or browser tabs
- 🔐 **GitHub Authentication**: Login with GitHub Personal Access Token
- 📤 **Auto Upload**: Automatically upload recordings to GitHub repository
- ⚙️ **Admin Settings**: Configure Firebase settings for different institutions
- 📝 **Subtitle Generation**: Generate SRT files with window titles
- 🎛️ **Customizable FPS**: Set frame rate (5, 10, 15, 30 FPS)
- 🔊 **Audio Support**: Record with audio

---

## 📦 Folder Structure

```

/Flexible-Screen-Recorder
├── manifest.json
├── popup.html
├── popup.js
├── window\.html
├── window\.js
├── settings.html
├── settings.js
├── download.png

````

---

## 🛠️ Installation & Setup

### For Students

1. **Install the Extension**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable Developer Mode (top right)
   - Click "Load unpacked" and select the project folder

2. **Get GitHub Token**:
   - Go to [GitHub Settings > Personal Access Tokens](https://github.com/settings/tokens)
   - Click "Generate new token (classic)"
   - Select "repo" scope
   - Copy the generated token

3. **Create Repository**:
   - Create a repository named `my_screen_recordings` in your GitHub account

4. **Login**:
   - Click "Login with GitHub Token" in the extension
   - Paste your GitHub token

### For Administrators

1. **Configure Firebase**: Go to extension settings and update Firebase configuration
2. **Update GitHub OAuth**: Update the GitHub Client ID and Secret in the code if needed

---

## ⚙️ Usage

1. Click the **extension icon** from the Chrome toolbar
2. Click **"Login with GitHub Token"** and enter your token
3. Click **"Start Recording"** to begin screen recording
4. Select what you want to record (screen, window, or tab)
5. Click **"Stop Recording"** when finished
6. Choose to upload the recording to your GitHub repository
7. The recording will be saved locally and uploaded to GitHub

---

## 🧩 Settings Page

1. Click the **gear icon ⚙️** in the popup (top-right).
2. Choose your desired **frame rate (FPS)**.
3. Click **Save Settings**.
4. This FPS will be used as default for all recordings.

---

## 🔐 Permissions Used

```json
"permissions": [
  "tabCapture",
  "downloads",
  "storage"
]
```

---

## 📄 License

This project is licensed under the MIT License.

