/**
 * The Last Paideia - Client Scripts
 * Handles authentication and video player initialization
 */

// Check config on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Only run gate logic on index page
  if (document.getElementById('auth-form')) {
    await initGate();
    initContactForm();
  }
});

/**
 * Initialize the contact/request access form
 */
function initContactForm() {
  const emailInput = document.getElementById('visitor-email');
  const sendBtn = document.getElementById('request-access-btn');
  
  if (!emailInput || !sendBtn) return;
  
  sendBtn.addEventListener('click', () => {
    const visitorEmail = emailInput.value.trim();
    const subject = encodeURIComponent('Request Access - The Last Paideia');
    const body = encodeURIComponent(
      `Hi,\n\nI would like to request access to view "The Last Paideia - The Regime of Quiet Hands".\n\n` +
      (visitorEmail ? `My email: ${visitorEmail}\n\n` : '') +
      `Thank you.`
    );
    
    window.location.href = `mailto:mohga@thelastpaideia.com?subject=${subject}&body=${body}`;
  });
  
  // Allow Enter key to trigger send
  emailInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendBtn.click();
    }
  });
}

/**
 * Initialize the password gate
 */
async function initGate() {
  const authSection = document.getElementById('auth-section');
  const loadingSection = document.getElementById('loading-section');
  const authForm = document.getElementById('auth-form');
  const errorMessage = document.getElementById('error-message');
  const passwordInput = document.getElementById('password');
  
  try {
    // Check if public or already authenticated
    const response = await fetch('/api/config');
    const config = await response.json();
    
    if (config.isPublic || config.isAuthenticated) {
      // Redirect to player
      window.location.href = '/watch';
      return;
    }
  } catch (error) {
    console.error('Config check failed:', error);
  }
  
  // Handle form submission
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = passwordInput.value.trim();
    if (!password) {
      showError('Please enter a passphrase');
      return;
    }
    
    // Show loading state
    authSection.classList.add('hidden');
    loadingSection.classList.remove('hidden');
    
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Redirect to player
        window.location.href = '/watch';
      } else {
        // Show error
        authSection.classList.remove('hidden');
        loadingSection.classList.add('hidden');
        showError(data.error || 'Invalid passphrase');
        passwordInput.value = '';
        passwordInput.focus();
      }
    } catch (error) {
      console.error('Auth error:', error);
      authSection.classList.remove('hidden');
      loadingSection.classList.add('hidden');
      showError('Connection error. Please try again.');
    }
  });
  
  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('visible');
    
    // Hide after 5 seconds
    setTimeout(() => {
      errorMessage.classList.remove('visible');
    }, 5000);
  }
  
  // Focus password input
  passwordInput.focus();
}

/**
 * Initialize the video player
 */
async function initPlayer() {
  const videoPlayer = document.getElementById('video-player');
  const videoLoading = document.getElementById('video-loading');
  const videoError = document.getElementById('video-error');
  const retryBtn = document.getElementById('retry-btn');
  const exitBtn = document.getElementById('exit-btn');
  const aboutBtn = document.getElementById('about-btn');
  const aboutModal = document.getElementById('about-modal');
  const modalClose = aboutModal?.querySelector('.modal-close');
  const modalBackdrop = aboutModal?.querySelector('.modal-backdrop');
  const videoTabs = document.querySelectorAll('.video-tab');
  
  if (!videoPlayer) return;
  
  // Check if public mode and swap buttons
  try {
    const configResponse = await fetch('/api/config');
    const config = await configResponse.json();
    
    if (config.isPublic) {
      // Public mode: show About button, hide Exit button
      exitBtn?.classList.add('hidden');
      aboutBtn?.classList.remove('hidden');
    } else {
      // Private mode: show Exit button, hide About button
      exitBtn?.classList.remove('hidden');
      aboutBtn?.classList.add('hidden');
    }
  } catch (error) {
    console.error('Config check failed:', error);
  }
  
  // Initialize tabs
  let currentVideoKey = 'quiethands/FinalCut.mp4';
  const subtitleElement = document.getElementById('player-subtitle');
  
  videoTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active state
      videoTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Get video key and subtitle from tab
      currentVideoKey = tab.dataset.key;
      const subtitle = tab.dataset.subtitle || '';
      
      // Update subtitle
      if (subtitleElement) {
        subtitleElement.textContent = subtitle;
      }
      
      // Load new video
      loadVideo(currentVideoKey);
    });
  });
  
  // Load initial video
  await loadVideo(currentVideoKey);
  
  async function loadVideo(videoKey = 'quiethands/FinalCut.mp4') {
    videoLoading.classList.remove('hidden');
    videoError.classList.add('hidden');
    
    // Pause current video
    videoPlayer.pause();
    
    try {
      const response = await fetch(`/api/video-url?key=${encodeURIComponent(videoKey)}`);
      
      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated, redirect to gate
          window.location.href = '/';
          return;
        }
        throw new Error('Failed to get video URL');
      }
      
      const data = await response.json();
      
      if (data.url) {
        // Remove old src to force reload
        videoPlayer.src = '';
        videoPlayer.load();
        
        // Set new src
        videoPlayer.src = data.url;
        
        // Handle video events (one-time handlers)
        const onLoadedMetadata = () => {
          videoLoading.classList.add('hidden');
          videoPlayer.removeEventListener('loadedmetadata', onLoadedMetadata);
          videoPlayer.removeEventListener('error', onError);
        };
        
        const onError = (e) => {
          console.error('Video error:', e);
          videoLoading.classList.add('hidden');
          videoError.classList.remove('hidden');
          videoPlayer.removeEventListener('loadedmetadata', onLoadedMetadata);
          videoPlayer.removeEventListener('error', onError);
        };
        
        videoPlayer.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
        videoPlayer.addEventListener('error', onError, { once: true });
        
        // Start loading
        videoPlayer.load();
      } else {
        throw new Error('No video URL returned');
      }
    } catch (error) {
      console.error('Video load error:', error);
      videoLoading.classList.add('hidden');
      videoError.classList.remove('hidden');
    }
  }
  
  // Retry button
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      const activeTab = document.querySelector('.video-tab.active');
      const videoKey = activeTab ? activeTab.dataset.key : 'quiethands/FinalCut.mp4';
      loadVideo(videoKey);
    });
  }
  
  // Exit button - logout and return to gate
  if (exitBtn) {
    exitBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/logout', { method: 'POST' });
      } catch (error) {
        console.error('Logout error:', error);
      }
      window.location.href = '/';
    });
  }
  
  // About button - show modal
  if (aboutBtn && aboutModal) {
    aboutBtn.addEventListener('click', () => {
      aboutModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    });
  }
  
  // Close modal handlers
  function closeModal() {
    aboutModal?.classList.add('hidden');
    document.body.style.overflow = '';
  }
  
  modalClose?.addEventListener('click', closeModal);
  modalBackdrop?.addEventListener('click', closeModal);
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape to close modal or exit
    if (e.key === 'Escape') {
      if (!aboutModal?.classList.contains('hidden')) {
        closeModal();
      } else {
        exitBtn?.click();
      }
    }
    
    // Don't handle other shortcuts if modal is open
    if (!aboutModal?.classList.contains('hidden')) return;
    
    // Space to play/pause (when not focused on video)
    if (e.key === ' ' && document.activeElement !== videoPlayer) {
      e.preventDefault();
      if (videoPlayer.paused) {
        videoPlayer.play();
      } else {
        videoPlayer.pause();
      }
    }
    
    // Arrow keys for seeking
    if (e.key === 'ArrowLeft') {
      videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 10);
    }
    if (e.key === 'ArrowRight') {
      videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + 10);
    }
    
    // F for fullscreen
    if (e.key === 'f' || e.key === 'F') {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoPlayer.requestFullscreen?.() || 
        videoPlayer.webkitRequestFullscreen?.() ||
        videoPlayer.msRequestFullscreen?.();
      }
    }
  });
}


