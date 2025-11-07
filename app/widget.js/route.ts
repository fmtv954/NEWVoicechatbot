import { NextResponse } from "next/server"

export async function GET() {
  const isDev = process.env.NODE_ENV === "development"
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  // Widget JavaScript code
  const widgetCode = `
(function() {
  'use strict';
  
  // Get the campaign ID from the script tag's data-campaign attribute
  const scriptTag = document.currentScript || document.querySelector('script[data-campaign]');
  const campaignId = scriptTag ? scriptTag.getAttribute('data-campaign') : null;
  
  if (!campaignId) {
    console.error('[Voice AI Widget] Missing data-campaign attribute');
    return;
  }

  // Fetch campaign data
  fetch('${appUrl}/api/campaigns/' + campaignId)
    .then(res => res.json())
    .then(campaign => {
      const currentOrigin = window.location.origin;
      const allowedOrigins = campaign.allowed_origins || [];
      
      // ===== ORIGIN CHECK HAPPENS HERE =====
      // In development, allow all origins (wildcard)
      const isDev = ${isDev};
      const isOriginAllowed = isDev || 
        allowedOrigins.includes('*') || 
        allowedOrigins.includes(currentOrigin);
      
      if (!isOriginAllowed) {
        console.warn(
          '[Voice AI Widget] Origin not allowed. Current origin: ' + currentOrigin + 
          ', Allowed origins: ' + JSON.stringify(allowedOrigins)
        );
        return;
      }
      // ===== END ORIGIN CHECK =====
      
      // Origin is allowed, render the widget
      renderWidget(campaignId);
    })
    .catch(err => {
      console.error('[Voice AI Widget] Failed to load campaign:', err);
    });

  function renderWidget(campaignId) {
    // Create widget container
    const container = document.createElement('div');
    container.id = 'voice-ai-widget';
    container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;font-family:system-ui,-apple-system,sans-serif;';
    document.body.appendChild(container);
    
    // Create floating button
    const button = document.createElement('button');
    button.id = 'voice-ai-button';
    button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>';
    button.style.cssText = 'width:60px;height:60px;border-radius:50%;background:#10b981;color:white;border:none;box-shadow:0 4px 12px rgba(0,0,0,0.15);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;';
    button.onmouseover = () => button.style.transform = 'scale(1.1)';
    button.onmouseout = () => button.style.transform = 'scale(1)';
    button.onclick = () => openModal();
    container.appendChild(button);
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'voice-ai-modal';
    modal.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;align-items:center;justify-content:center;';
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = 'background:white;border-radius:16px;padding:32px;max-width:400px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);position:relative;';
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = 'position:absolute;top:12px;right:12px;background:none;border:none;font-size:32px;color:#64748b;cursor:pointer;line-height:1;padding:0;width:32px;height:32px;';
    closeBtn.onclick = () => closeModal();
    
    const iframe = document.createElement('iframe');
    iframe.src = '${appUrl}/a/' + campaignId + '?embed=true';
    iframe.style.cssText = 'width:100%;height:500px;border:none;border-radius:8px;';
    
    modalContent.appendChild(closeBtn);
    modalContent.appendChild(iframe);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    function openModal() {
      modal.style.display = 'flex';
    }
    
    function closeModal() {
      modal.style.display = 'none';
    }
    
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
  }
})();
`.trim()

  return new NextResponse(widgetCode, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=3600",
    },
  })
}
