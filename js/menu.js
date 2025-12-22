 (function(){
          const toggle = document.querySelector('.lang-toggle');
          const menu = document.querySelector('.lang-menu');
          const items = Array.from(document.querySelectorAll('.lang-item'));
          if(!toggle || !menu) return;
          function close(){ menu.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); }
          function open(){ menu.classList.add('open'); toggle.setAttribute('aria-expanded','true'); }

          // initialize toggle text from selected item
          const current = items.find(i=> i.classList.contains('selected')) || items[0];
          if(current){
            const code = current.dataset.lang || current.textContent.trim();
            // show only code in the top toggle
            toggle.textContent = code;
          }

          toggle.addEventListener('click', (e)=>{
            const isOpen = menu.classList.toggle('open');
            toggle.setAttribute('aria-expanded', isOpen);
          });

          items.forEach(i=> i.addEventListener('click', (e)=>{
            const lang = i.dataset.lang || i.textContent.trim();
            // update toggle to show code only
            toggle.textContent = lang;
            // mark selected
            items.forEach(x=> x.classList.remove('selected'));
            i.classList.add('selected');
            close();
          }));

          document.addEventListener('click', (e)=>{
            if(!menu.contains(e.target) && !toggle.contains(e.target)) close();
          });
          document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') close(); });
        })();