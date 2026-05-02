
// Mini Chat Logic
document.addEventListener('DOMContentLoaded', () => {
    const sendBtn = document.getElementById('sendBtn');
    const attachBtn = document.getElementById('attachBtn');
    const messageInput = document.getElementById('messageInput');
    const fileInput = document.getElementById('fileInput');
    const chatMessages = document.getElementById('chatMessages');

    function sendMessage() {
        const text = messageInput.value.trim();
        if(text === '') return;

        // Create outgoing message
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'outgoing');
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageDiv.innerHTML = `
            <div class="message-content">
                <p>${text}</p>
                <span class="time">${timeStr}</span>
            </div>
        `;

        chatMessages.appendChild(messageDiv);
        messageInput.value = '';
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Simulate incoming response
        setTimeout(() => {
            const replyDiv = document.createElement('div');
            replyDiv.classList.add('message', 'incoming');
            replyDiv.innerHTML = `
                <div class="message-content">
                    <p>I received your message: "${text}"</p>
                    <span class="time1">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            `;
            chatMessages.appendChild(replyDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 1000);
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    if (attachBtn) {
        attachBtn.addEventListener('click', () => {
            fileInput.click();
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if(fileInput.files.length > 0) {
                const fileName = fileInput.files[0].name;
                const messageDiv = document.createElement('div');
                messageDiv.classList.add('message', 'outgoing');
                const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                messageDiv.innerHTML = `
                    <div class="message-content">
                        <p>📎 ${fileName}</p>
                        <span class="time">${timeStr}</span>
                    </div>
                `;
                chatMessages.appendChild(messageDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        });
    }
});


// Responsive right sidebar handling - Accordion Style
document.addEventListener('DOMContentLoaded', () => {
    const chatSidebar = document.querySelector('.chat-sidebar');
    const rightContainer = document.querySelector('.right');
    const mainContainer = document.querySelector('main');
    const chatBlock = document.querySelector('.chat');

    if (!chatSidebar || !rightContainer || !mainContainer || !chatBlock) return;

    // Create toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.classList.add('mobile-chats-toggle-btn');
    toggleBtn.innerHTML = '<span data-i18n="your_chats">Ваши чаты</span><span class="material-icons-sharp icon-arrow">expand_more</span>';
    
    // Insert toggle button before chat area in main
    mainContainer.insertBefore(toggleBtn, chatBlock);

    toggleBtn.addEventListener('click', () => {
        const isExpanded = chatSidebar.classList.toggle('expanded');
        toggleBtn.classList.toggle('active', isExpanded);
        
        if (isExpanded) {
            chatSidebar.style.maxHeight = Math.max(chatSidebar.scrollHeight, 400) + 100 + 'px';
            chatSidebar.style.opacity = '1';
            chatSidebar.style.padding = 'var(--card-padding)';
        } else {
            chatSidebar.style.maxHeight = '0px';
            chatSidebar.style.opacity = '0';
            chatSidebar.style.padding = '0 var(--card-padding)';
        }
    });

    function updateLayout() {
        if (window.innerWidth <= 1024) {
            // Relocate to main on mobile/tablet
            if (chatSidebar.parentElement !== mainContainer) {
                mainContainer.insertBefore(chatSidebar, chatBlock);
                toggleBtn.style.display = 'flex';
                
                // Reset sidebar for accordion
                chatSidebar.classList.remove('expanded');
                toggleBtn.classList.remove('active');
                chatSidebar.style.maxHeight = '0px';
                chatSidebar.style.opacity = '0';
                chatSidebar.style.overflow = 'hidden';
                chatSidebar.style.padding = '0 var(--card-padding)';
                chatSidebar.style.marginTop = '0';
                chatSidebar.style.transition = 'max-height 0.4s ease-in-out, opacity 0.4s ease-in-out, padding 0.4s ease-in-out';
            }
        } else {
            // Put it back to .right on desktop
            if (chatSidebar.parentElement !== rightContainer) {
                rightContainer.appendChild(chatSidebar);
                toggleBtn.style.display = 'none';
                
                // Reset styles
                chatSidebar.style.maxHeight = 'none';
                chatSidebar.style.opacity = '1';
                chatSidebar.style.overflow = 'visible';
                chatSidebar.style.padding = 'var(--card-padding)';
                chatSidebar.style.marginTop = '0';
                chatSidebar.style.transition = 'none';
            }
        }
    }

    // Trigger update on resize and load
    window.addEventListener('resize', updateLayout);
    updateLayout();
});
