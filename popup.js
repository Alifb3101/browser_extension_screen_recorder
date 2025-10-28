// popup.js

// --- 🔥 Firebase config (will be loaded from storage) ---
let firebaseConfig = {
  apiKey: "AIzaSyAbgVydchx_GCMN29TjZg4ATm54sXM8F-E",
  authDomain: "my-screen-recoder.firebaseapp.com",
  projectId: "my-screen-recoder",
  storageBucket: "my-screen-recoder.firebasestorage.app",
  messagingSenderId: "447344017595",
  appId: "1:447344017595:web:086e776b5689810de9699e",
  measurementId: "G-MB2BLCWL1R"
};

// GitHub OAuth credentials
const GITHUB_CLIENT_ID = "Ov23likikMwL3udWebqG";
const GITHUB_CLIENT_SECRET = "3ff99d96a6d987722bc3067d61c4e8ac61504dd9";
chrome.storage.sync.get(['firebaseConfig'], (result) => {
  if (result.firebaseConfig) {
    firebaseConfig = result.firebaseConfig;
  }
  setupEventListeners();
});

// --- Elements ---
let loginBtn, logoutBtn, usernameEl, userInfo, startBtn, stopBtn, stopShareBtn, settingsIcon;

let recorderWindow = null;
let currentUser = null;
let githubToken = null;

function setupEventListeners() {
  loginBtn = document.getElementById("loginBtn");
  logoutBtn = document.getElementById("logoutBtn");
  usernameEl = document.getElementById("username");
  userInfo = document.getElementById("userInfo");
  startBtn = document.getElementById("start");
  stopBtn = document.getElementById("stopRecordingBtn");
  stopShareBtn = document.getElementById("stopShare");
  settingsIcon = document.getElementById("settings-icon");

  // ---------- 🔐 GITHUB LOGIN ----------
  loginBtn.addEventListener("click", async () => {
    try {
      // Use Chrome identity API with proper error handling
      const redirectUrl = chrome.identity.getRedirectURL();
      console.log("Redirect URL:", redirectUrl);
      
      // For now, let's use a simple approach - ask user to manually get token
      const token = prompt("Please enter your GitHub Personal Access Token:\n\n1. Go to https://github.com/settings/tokens\n2. Generate new token with 'repo' scope\n3. Copy and paste it here:");
      
      if (!token) {
        alert("❌ No token provided. Login cancelled.");
        return;
      }
      
      // Verify token by getting user info
      try {
        const userResponse = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        
        if (!userResponse.ok) {
          throw new Error(`HTTP ${userResponse.status}: ${userResponse.statusText}`);
        }
        
        const userData = await userResponse.json();
        
        // Set current user and token
        currentUser = {
          uid: userData.id,
          displayName: userData.login,
          email: userData.email,
          photoURL: userData.avatar_url
        };
        githubToken = token;
        
        // Store user data for persistence
        chrome.storage.local.set({
          currentUser: currentUser,
          githubToken: githubToken
        });
        
        usernameEl.textContent = currentUser.displayName || currentUser.email;
        userInfo.style.display = "block";
        loginBtn.style.display = "none";

        // Check if user has the required repository
        await checkUserRepository();
        
        alert("✅ Login successful!");
      } catch (error) {
        console.error("Token verification failed:", error);
        alert(`❌ Invalid token: ${error.message}`);
      }
    } catch (error) {
      console.error("GitHub login failed:", error);
      alert("❌ Login failed. Check console for details.");
    }
  });

  logoutBtn.addEventListener("click", async () => {
    currentUser = null;
    githubToken = null;
    
    // Clear stored user data
    chrome.storage.local.remove(['currentUser', 'githubToken']);
    
    userInfo.style.display = "none";
    loginBtn.style.display = "block";
    alert("🔒 Logged out successfully.");
  });

  // Check for existing auth state on load
  chrome.storage.local.get(['currentUser', 'githubToken'], (result) => {
    if (result.currentUser && result.githubToken) {
      currentUser = result.currentUser;
      githubToken = result.githubToken;
      usernameEl.textContent = currentUser.displayName || currentUser.email;
      userInfo.style.display = "block";
      loginBtn.style.display = "none";
    }
  });

  // ---------- 🎥 SCREEN RECORDING ----------
  startBtn.addEventListener("click", async () => {
    const { fps = 30 } = await chrome.storage.sync.get(["fps"]);
    
    // Send message to background script to create window
    chrome.runtime.sendMessage({
      type: "CREATE_RECORDING_WINDOW",
      fps: fps
    }, (response) => {
      if (response && response.success) {
        recorderWindow = { id: response.windowId };
        console.log("Recording window created with ID:", response.windowId);
      } else {
        console.error("Failed to create recording window:", response?.error);
        alert("❌ Failed to open recording window. Please try again.");
      }
    });
  });

  stopShareBtn.addEventListener("click", () => {
    // Use the unified message type so background can route the stop to the recorder window/tab
    chrome.runtime.sendMessage({ type: "STOP_SCREEN_RECORDING" }, (res) => {
      alert(res?.success ? "Recording stopped." : "No active recording.");
    });
  });

  stopBtn.addEventListener("click", async () => {
    // Stop the recording (fire-and-forget)
    chrome.runtime.sendMessage({ type: "STOP_SCREEN_RECORDING" });

    // Ask user if they want to upload to GitHub. If yes, open the file picker immediately
    // inside this user click handler so the browser allows the file chooser.
    if (currentUser && githubToken) {
      const upload = confirm("Do you want to upload the recording to your GitHub repository 'my_screen_recordings'?");
      if (upload) {
        // Create a file input and open it synchronously (user activation)
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.webm';
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', async (event) => {
          const file = event.target.files[0];
          if (!file) {
            alert('No file selected. Upload cancelled.');
            return;
          }

          try {
            await uploadToGitHub(file);
          } catch (err) {
            console.error('Upload failed:', err);
            alert('Upload failed. See console for details.');
          }
        });

        // Add to DOM so click works in some browsers, then trigger
        document.body.appendChild(fileInput);
        fileInput.click();
        // Remove the element after a short delay to allow file dialog to open
        setTimeout(() => fileInput.remove(), 1000);
      }
    }
  });

  settingsIcon.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  chrome.windows.onRemoved.addListener((windowId) => {
    if (recorderWindow && recorderWindow.id === windowId) {
      recorderWindow = null;
    }
  });
}

// ---------- 🔍 GITHUB REPOSITORY CHECKING ----------
async function checkUserRepository() {
  if (!githubToken) {
    console.error("No GitHub token available");
    return false;
  }

  try {
    const response = await fetch('https://api.github.com/user/repos', {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const repos = await response.json();
    const hasRequiredRepo = repos.some(repo => repo.name === 'my_screen_recordings');
    
    if (!hasRequiredRepo) {
      alert("⚠️ Please create a repository named 'my_screen_recordings' in your GitHub account to upload recordings.");
    }
    
    return hasRequiredRepo;
  } catch (error) {
    console.error("Error checking repositories:", error);
    alert("❌ Failed to check GitHub repositories. Please try again.");
    return false;
  }
}

// ---------- 📤 GITHUB UPLOAD ----------
// Accept an optional File selected by the user. If provided, use it directly.
async function uploadToGitHub(selectedFile) {
  if (!githubToken) {
    alert("❌ No GitHub token available. Please login again.");
    return;
  }

  try {
    // Check if repository exists
    const repoExists = await checkUserRepository();
    if (!repoExists) {
      return;
    }

    // If a File was passed (from a user file picker), read and upload it.
    if (selectedFile) {
      const filename = selectedFile.name || `recording_${Date.now()}.webm`;
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Content = e.target.result.split(',')[1];
          await uploadFileToGitHubBase64(base64Content, filename);
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
          alert('❌ Upload failed. Please try again.');
        }
      };
      reader.readAsDataURL(selectedFile);
      return;
    }

    // Fallback: keep previous behavior (may be blocked if not triggered by user gesture)
    const result = await chrome.storage.local.get(['latestRecordingId', 'latestRecordingFilename']);
    if (!result.latestRecordingId) {
      alert("❌ No recording found to upload. Please record something first.");
      return;
    }

    const recordings = await chrome.downloads.search({ id: result.latestRecordingId });
    if (recordings.length === 0) {
      alert("❌ Recording file not found. Please try recording again.");
      return;
    }

    const filename = result.latestRecordingFilename || `recording_${Date.now()}.webm`;
    alert(`Please select the recording file to upload. Look for a file named "${filename}" in your Downloads folder.`);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.webm';
    fileInput.onchange = async (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const base64Content = e.target.result.split(',')[1];
            await uploadFileToGitHubBase64(base64Content, filename);
          } catch (uploadError) {
            console.error('Upload error:', uploadError);
            alert('❌ Upload failed. Please try again.');
          }
        };
        reader.readAsDataURL(file);
      }
    };
    fileInput.click();
  } catch (error) {
    console.error("Upload error:", error);
    alert("❌ Upload failed. Please check console for details.");
  }
}

async function uploadFileToGitHub(fileContent, filename) {
  try {
    // Check file size (GitHub has a 100MB limit)
    const fileSizeMB = fileContent.byteLength / (1024 * 1024);
    if (fileSizeMB > 100) {
      alert(`❌ File too large (${fileSizeMB.toFixed(1)}MB). GitHub has a 100MB limit for individual files.`);
      return;
    }
    
    console.log(`Uploading file: ${filename} (${fileSizeMB.toFixed(1)}MB)`);
    
    // Convert ArrayBuffer to base64 using a more robust method
    const uint8Array = new Uint8Array(fileContent);
    
    // Use a safer approach for large files
    let base64Content = '';
    const chunkSize = 1024; // Smaller chunks to avoid issues
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      // Convert chunk to string safely
      let binaryString = '';
      for (let j = 0; j < chunk.length; j++) {
        binaryString += String.fromCharCode(chunk[j]);
      }
      base64Content += btoa(binaryString);
    }

    await uploadFileToGitHubBase64(base64Content, filename);
  } catch (error) {
    console.error("Upload error:", error);
    alert(`❌ Upload failed: ${error.message}`);
  }
}

async function uploadFileToGitHubBase64(base64Content, filename) {
  try {
    // Validate base64 content
    if (!base64Content || typeof base64Content !== 'string') {
      throw new Error('Invalid base64 content');
    }
    
    // Check if base64 is valid
    try {
      atob(base64Content.substring(0, 100)); // Test first 100 chars
    } catch (e) {
      throw new Error('Invalid base64 encoding');
    }
    
    console.log(`Uploading file: ${filename} (base64 length: ${base64Content.length})`);

    // Upload to GitHub
    const uploadResponse = await fetch(`https://api.github.com/repos/${currentUser.displayName}/my_screen_recordings/contents/${filename}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Upload screen recording - ${new Date().toISOString()}`,
        content: base64Content
      })
    });

    if (uploadResponse.ok) {
      alert("✅ Recording uploaded to GitHub successfully!");
    } else {
      const error = await uploadResponse.json();
      console.error("Upload failed:", error);
      alert(`❌ Failed to upload to GitHub: ${error.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error("Upload error:", error);
    alert(`❌ Upload failed: ${error.message}`);
  }
}
