/* ─────────────────────────────────────────────
   Platinum Sales Chatbot — chatbot.js
   Handles: toggle, send, typing simulation,
   auto-resize textarea, quick suggestions
───────────────────────────────────────────── */

(function () {
  const bubble   = document.getElementById('cbBubble');
  const window_  = document.getElementById('cbWindow');
  const closeBtn = document.getElementById('cbClose');
  const clearBtn = document.getElementById('cbClear');
  const input    = document.getElementById('cbInput');
  const sendBtn  = document.getElementById('cbSend');
  const messages = document.getElementById('cbMessages');
  const typing   = document.getElementById('cbTyping');
  const badge    = document.getElementById('cbBadge');
  const suggestions = document.getElementById('cbSuggestions');

  let isOpen = false;

  /* ── Toggle window ── */
  function openChat() {
    isOpen = true;
    bubble.classList.add('is-open');
    window_.classList.add('is-open');
    badge.style.opacity = '0';
    input.focus();
  }

  function closeChat() {
    isOpen = false;
    bubble.classList.remove('is-open');
    window_.classList.remove('is-open');
  }

  bubble.addEventListener('click', () => isOpen ? closeChat() : openChat());
  closeBtn.addEventListener('click', closeChat);

  /* ── Clear ── */
  clearBtn.addEventListener('click', () => {
    // Keep only the initial greeting + suggestions
    const msgs = messages.querySelectorAll('.cb-msg, .cb-divider');
    msgs.forEach(m => {
      // Remove user messages; keep first bot greeting
      if (m.classList.contains('cb-msg--user')) m.remove();
    });
    if (suggestions) suggestions.style.display = 'flex';
  });

  /* ── Auto-resize textarea ── */
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    sendBtn.disabled = !input.value.trim();
  });

  /* ── Enter to send (Shift+Enter = newline) ── */
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) send();
    }
  });

  sendBtn.addEventListener('click', send);

  /* ── Quick suggestions ── */
  document.querySelectorAll('.cb-suggestion').forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = btn.dataset.msg;
      if (suggestions) suggestions.style.display = 'none';
      appendMessage(msg, 'user');
      simulateReply(msg);
    });
  });

  /* ── Send ── */
  function send() {
    const text = input.value.trim();
    if (!text) return;
    if (suggestions) suggestions.style.display = 'none';
    appendMessage(text, 'user');
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;
    simulateReply(text);
  }

  /* ── Append a message bubble ── */
  function appendMessage(text, role) {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const wrap = document.createElement('div');
    wrap.className = `cb-msg cb-msg--${role}`;

    if (role === 'bot') {
      wrap.innerHTML = `
        <div class="cb-msg__avatar">PS</div>
        <div class="cb-msg__body">
          <div class="cb-msg__bubble">${escapeHtml(text)}</div>
          <div class="cb-msg__time">${time}</div>
        </div>`;
    } else {
      wrap.innerHTML = `
        <div class="cb-msg__body">
          <div class="cb-msg__bubble">${escapeHtml(text)}</div>
          <div class="cb-msg__time">${time}</div>
        </div>`;
    }

    messages.appendChild(wrap);
    scrollToBottom();
  }

  /* ── Simulate bot reply with typing ── */
  function simulateReply(userText) {
    typing.classList.add('is-visible');
    scrollToBottom();

    const reply = getReply(userText.toLowerCase());
    const delay = 900 + Math.random() * 700;

    setTimeout(() => {
      typing.classList.remove('is-visible');
      appendMessage(reply, 'bot');
    }, delay);
  }

  /* ── Static reply map ── */
  function getReply(text) {
    if (text.includes('appointment'))
      return "📅 You have 3 appointments today — Rajan at 10:00 AM, Meena at 1:30 PM, and Suresh at 4:00 PM. Want me to open the full schedule?";
    if (text.includes('hot lead') || text.includes('hot leads'))
      return "🔥 There are currently 14 hot leads in the pipeline. 6 are follow-up due today. Want me to list them?";
    if (text.includes('enquiry') || text.includes('enquiries') || text.includes('new enquiry'))
      return "✎ I can take you to the Enquiry Form. Just click the form link in the sidebar, or say 'open enquiry form' and I'll navigate you there.";
    if (text.includes('report') || text.includes('sales report'))
      return "📊 This month: ₹18.4L revenue across 42 closed deals. Hot leads up 12% vs last month. Full Director Report is available in the Reports section.";
    if (text.includes('lead') || text.includes('leads'))
      return "📋 Total leads this week: 38. Hot: 14 · Warm: 18 · Cold: 6. Conversion rate is at 31% — up from 26% last week.";
    if (text.includes('hello') || text.includes('hi') || text.includes('hey'))
      return "👋 Hey there! What can I help you with — leads, appointments, reports, or something else?";
    if (text.includes('feedback'))
      return "⭐ 27 feedback entries this month. Average rating: 4.2/5. 3 are pending review. Open the Feedback tab for details.";
    if (text.includes('help'))
      return "I can help with:\n• Checking leads and pipeline\n• Viewing today's appointments\n• Sales reports & metrics\n• Navigating the CRM\n\nJust ask away!";
    return "I'm looking that up… In the meantime, you can check the sidebar for quick access to Enquiries, Appointments, and Reports.";
  }

  /* ── Scroll messages to bottom ── */
  function scrollToBottom() {
    requestAnimationFrame(() => {
      messages.scrollTop = messages.scrollHeight;
    });
  }

  /* ── Escape HTML ── */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '<br>');
  }

})();
