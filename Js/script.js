let posts = [];
let comments = {};
let reactions = {};
let currentPostId = null;
let editingPostId = null;
let deletingPostId = null;
let activeFilter = 'all';
let mouse = {x: -999, y: -999};

/* ---- STARFIELD with mouse repulsion ---- */
(function(){
  const c = document.getElementById('starfield');
  const ctx = c.getContext('2d');
  let stars = [];

  function resize(){
    c.width = innerWidth;
    c.height = innerHeight;
    stars = Array.from({length: 150}, () => ({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      ox: 0, oy: 0,
      r: Math.random() * 1.5 + 0.3,
      o: Math.random(),
      sp: Math.random() * 0.4 + 0.1,
      vx: 0, vy: 0
    }));
    stars.forEach(s => { s.ox = s.x; s.oy = s.y; });
  }
  resize();
  window.addEventListener('resize', resize);

  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mouseleave', () => { mouse.x = -999; mouse.y = -999; });

  function draw(){
    ctx.clearRect(0, 0, c.width, c.height);
    stars.forEach(s => {
      const dx = s.x - mouse.x;
      const dy = s.y - mouse.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const radius = 120;
      if(dist < radius && dist > 0){
        const force = (radius - dist) / radius;
        s.vx += (dx / dist) * force * 1.8;
        s.vy += (dy / dist) * force * 1.8;
      }
      // spring back to origin
      s.vx += (s.ox - s.x) * 0.04;
      s.vy += (s.oy - s.y) * 0.04;
      // damping
      s.vx *= 0.88;
      s.vy *= 0.88;
      s.x += s.vx;
      s.y += s.vy;

      s.o += s.sp * 0.008;
      if(s.o > 1 || s.o < 0) s.sp *= -1;

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      const isCyan = (s.x + s.y) % 3 > 1;
      ctx.fillStyle = `rgba(${isCyan ? '0,212,255' : '180,140,255'},${s.o * 0.75})`;
      ctx.fill();

      // draw connections near mouse
      if(dist < radius * 1.2){
        stars.forEach(q => {
          const d2 = Math.hypot(s.x - q.x, s.y - q.y);
          if(d2 < 80 && d2 > 0){
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(0,212,255,${(1 - d2/80) * 0.18})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      }
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

/* ---- NAVBAR scroll effect ---- */
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 20);
});

/* ---- EDITOR ---- */
function openEditor(postId){
  editingPostId = postId || null;
  document.getElementById('editor-label').textContent = postId ? '✦ Edit Post' : '✦ Write a New Post';
  if(postId){
    const p = posts.find(x => x.id === postId);
    document.getElementById('editor-title').value = p.title;
    document.getElementById('editor-cat').value = p.cat;
    document.getElementById('editor-excerpt').value = p.excerpt || '';
    document.getElementById('editor-body').value = p.body;
  } else {
    document.getElementById('editor-title').value = '';
    document.getElementById('editor-cat').value = '';
    document.getElementById('editor-excerpt').value = '';
    document.getElementById('editor-body').value = '';
  }
  updateCharCount();
  document.getElementById('editor-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('editor-title').focus(), 50);
}

function closeEditor(){
  document.getElementById('editor-modal').style.display = 'none';
  document.body.style.overflow = '';
}

// Close editor only when clicking the dark overlay itself (not the modal)
document.getElementById('editor-modal').addEventListener('click', function(e){
  if(e.target === this) closeEditor();
});

function updateCharCount(){
  const body = document.getElementById('editor-body').value;
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const mins = Math.max(1, Math.round(words / 200));
  document.getElementById('char-count').textContent = `${body.length} chars · ~${mins} min read`;
}
document.getElementById('editor-body').addEventListener('input', updateCharCount);

function ins(before, after){
  const ta = document.getElementById('editor-body');
  const s = ta.selectionStart, e = ta.selectionEnd;
  const sel = ta.value.substring(s, e);
  ta.value = ta.value.substring(0, s) + before + sel + after + ta.value.substring(e);
  ta.selectionStart = s + before.length;
  ta.selectionEnd = s + before.length + sel.length;
  ta.focus(); updateCharCount();
}
function insLine(prefix){
  const ta = document.getElementById('editor-body');
  const s = ta.selectionStart;
  const insert = '\n' + prefix;
  ta.value = ta.value.substring(0, s) + insert + ta.value.substring(s);
  ta.selectionStart = ta.selectionEnd = s + insert.length;
  ta.focus(); updateCharCount();
}

function publishPost(){
  const title = document.getElementById('editor-title').value.trim();
  const cat = document.getElementById('editor-cat').value;
  const excerpt = document.getElementById('editor-excerpt').value.trim();
  const body = document.getElementById('editor-body').value.trim();
  if(!title || !cat || !body){ alert('Please fill in Title, Category, and Body.'); return; }
  const words = body.trim().split(/\s+/).length;
  const readTime = Math.max(1, Math.round(words / 200));
  const dateStr = new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'});

  if(editingPostId){
    const idx = posts.findIndex(p => p.id === editingPostId);
    posts[idx] = {...posts[idx], title, cat, excerpt: excerpt || body.slice(0,120)+'…', body, readTime};
  } else {
    const id = Date.now();
    posts.unshift({id, title, cat, excerpt: excerpt || body.slice(0,120)+'…', body, readTime, date: dateStr});
    comments[id] = [];
    reactions[id] = {like:0, heart:0, fire:0, reacted:{}};
  }
  closeEditor();
  renderGrid();
  if(editingPostId && currentPostId === editingPostId) openPost(editingPostId);
}

/* ---- GRID ---- */
const catLabel = {ai:'AI & ML', web:'Web Dev', tools:'Tools', thoughts:'Thoughts'};

function renderGrid(query=''){
  const grid = document.getElementById('blog-grid');
  let filtered = activeFilter === 'all' ? posts : posts.filter(p => p.cat === activeFilter);
  if(query) filtered = filtered.filter(p =>
    p.title.toLowerCase().includes(query) ||
    p.excerpt.toLowerCase().includes(query) ||
    p.body.toLowerCase().includes(query) ||
    catLabel[p.cat].toLowerCase().includes(query)
  );
  if(!filtered.length){
    grid.innerHTML = `<div class="empty-state">
      <div class="empty-icon">✦</div>
      <h3>${activeFilter==='all' ? 'No posts yet' : 'No posts in this category'}</h3>
      <p>${activeFilter==='all' ? 'Your blog is empty. Start writing!' : 'Try a different filter or write a new post.'}</p>
      ${activeFilter==='all' ? '<span class="empty-cta" onclick="openEditor()">Write your first post →</span>' : ''}
    </div>`;
    return;
  }
  grid.innerHTML = filtered.map((p, i) => `
    <div class="blog-card" style="animation-delay:${i*0.06}s" data-id="${p.id}" data-cat="${p.cat}">
      <div class="card-actions">
        <button class="card-act-btn" title="Edit" data-edit="${p.id}">✎</button>
        <button class="card-act-btn del" title="Delete" data-del="${p.id}">✕</button>
      </div>
      <div class="card-tag ${p.cat}">${catLabel[p.cat]}</div>
      <h3>${p.title}</h3>
      <p>${p.excerpt}</p>
      <div class="card-meta">
        <span>${p.date}</span>
        <span>${p.readTime} min read</span>
      </div>
    </div>`).join('');

  // delegate events — one listener, no inline handlers on dynamically created elements
  grid.querySelectorAll('.blog-card').forEach(card => {
    const id = Number(card.dataset.id);
    card.addEventListener('click', e => {
      if(e.target.closest('.card-actions')) return;
      openPost(id);
    });
    card.querySelector('[data-edit]').addEventListener('click', e => {
      e.stopPropagation();
      openEditor(id);
    });
    card.querySelector('[data-del]').addEventListener('click', e => {
      e.stopPropagation();
      askDelete(id);
    });
  });
}

function filterPosts(cat, btn){
  activeFilter = cat;
  document.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  clearSearch();
  renderGrid();
}

function searchPosts(q){
  const clear = document.getElementById('search-clear');
  clear.style.display = q ? 'block' : 'none';
  renderGrid(q.trim().toLowerCase());
}

function clearSearch(){
  const inp = document.getElementById('search-input');
  inp.value = '';
  document.getElementById('search-clear').style.display = 'none';
  renderGrid();
}

/* ---- POST VIEW ---- */
function openPost(id){
  currentPostId = id;
  const p = posts.find(x => x.id === id);
  const r = reactions[id];
  document.getElementById('post-content').innerHTML = `
    <div class="post-header">
      <div class="card-tag ${p.cat}" style="margin-bottom:.85rem">${catLabel[p.cat]}</div>
      <h1><span>${p.title}</span></h1>
      ${p.excerpt ? `<p class="post-desc">${p.excerpt}</p>` : ''}
      <div class="post-meta-row">
        <span>${p.date}</span>
        <span>${p.readTime} min read</span>
      </div>
    </div>
    <div class="share-row" style="margin-bottom:1rem">
      <span>Share:</span>
      <button class="share-btn" id="copy-btn">🔗 Copy link</button>
      <button class="share-btn" id="tw-btn">𝕏 Twitter</button>
      <button class="share-btn" id="li-btn">in LinkedIn</button>
    </div>
    <div class="divider"></div>
    <div class="post-body">${renderMarkdown(p.body)}</div>
    <div class="divider"></div>
    <div class="reactions" id="reactions-${id}">
      <span>React:</span>
      <button class="react-btn ${r.reacted.like?'reacted':''}" data-react="like">👍 <span class="cnt">${r.like||''}</span></button>
      <button class="react-btn ${r.reacted.heart?'reacted':''}" data-react="heart">❤️ <span class="cnt">${r.heart||''}</span></button>
      <button class="react-btn ${r.reacted.fire?'reacted':''}" data-react="fire">🔥 <span class="cnt">${r.fire||''}</span></button>
    </div>
    <div class="divider"></div>
    <div class="comments-section">
      <h3>Comments <span id="cmt-count">${comments[id].length}</span></h3>
      <div class="comment-form">
        <input id="cn" type="text" placeholder="Your name"/>
        <textarea id="ct" placeholder="Share your thoughts..." rows="3"></textarea>
        <button class="submit-btn" id="submit-cmt">Post Comment</button>
      </div>
      <div id="cmt-list">${renderComments(id)}</div>
    </div>`;

  document.getElementById('copy-btn').onclick = copyLink;
  document.getElementById('tw-btn').onclick = () => shareTwitter(p.title);
  document.getElementById('li-btn').onclick = shareLinkedIn;
  document.getElementById('submit-cmt').onclick = () => addComment(id);
  document.querySelectorAll('[data-react]').forEach(btn => {
    btn.onclick = () => react(id, btn.dataset.react, btn);
  });

  document.getElementById('page-home').classList.remove('active');
  document.getElementById('page-post').classList.add('active');
  window.scrollTo(0, 0);
  document.getElementById('progress-bar').style.display = 'block';
  trackProgress();
}

function renderMarkdown(text){
  const esc = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return esc
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:1rem 0">')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/^(?!<[hupbli]|<pre|<blockquote|<hr)(.+)/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
}

function goHome(){
  document.getElementById('page-post').classList.remove('active');
  document.getElementById('page-home').classList.add('active');
  document.getElementById('progress-bar').style.display = 'none';
  document.getElementById('progress-bar').style.width = '0%';
  currentPostId = null;
  window.scrollTo(0, 0);
}

function trackProgress(){
  if(!document.getElementById('page-post').classList.contains('active')) return;
  const d = document.documentElement;
  const pct = d.scrollTop / (d.scrollHeight - d.clientHeight) * 100;
  document.getElementById('progress-bar').style.width = Math.min(pct, 100) + '%';
  requestAnimationFrame(trackProgress);
}

/* ---- REACTIONS ---- */
function react(id, key, btn){
  const r = reactions[id];
  if(r.reacted[key]){ r[key]--; r.reacted[key] = false; }
  else { r[key]++; r.reacted[key] = true; }
  btn.classList.toggle('reacted', r.reacted[key]);
  btn.querySelector('.cnt').textContent = r[key] || '';
  btn.style.transform = 'scale(1.2)';
  setTimeout(() => btn.style.transform = '', 280);
}

/* ---- COMMENTS ---- */
function renderComments(id){
  if(!comments[id].length) return '<p style="font-size:.83rem;color:var(--muted);padding:.4rem 0">No comments yet. Be the first!</p>';
  return comments[id].map(c => `
    <div class="comment-item">
      <div class="comment-header">
        <div class="avatar">${c.initials}</div>
        <span class="comment-name">${c.name}</span>
        <span class="comment-date">${c.date}</span>
      </div>
      <div class="comment-text">${c.text}</div>
    </div>`).join('');
}

function addComment(id){
  const name = document.getElementById('cn').value.trim();
  const text = document.getElementById('ct').value.trim();
  if(!name || !text) return;
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
  const dateStr = new Date().toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'});
  comments[id].unshift({name, text, initials, date: dateStr});
  document.getElementById('cmt-list').innerHTML = renderComments(id);
  document.getElementById('cmt-count').textContent = comments[id].length;
  document.getElementById('cn').value = '';
  document.getElementById('ct').value = '';
}

/* ---- DELETE — clean, self-contained ---- */
function askDelete(id){
  deletingPostId = id;
  document.getElementById('del-overlay').style.display = 'flex';
}
function closeDelModal(){
  document.getElementById('del-overlay').style.display = 'none';
  deletingPostId = null;
}
document.getElementById('del-no-btn').addEventListener('click', closeDelModal);
document.getElementById('del-yes-btn').addEventListener('click', function(){
  if(deletingPostId === null) return;
  posts = posts.filter(p => p.id !== deletingPostId);
  delete comments[deletingPostId];
  delete reactions[deletingPostId];
  const wasViewing = currentPostId === deletingPostId;
  closeDelModal();
  if(wasViewing) goHome();
  else renderGrid();
});
document.getElementById('del-overlay').addEventListener('click', function(e){
  if(e.target === this) closeDelModal();
});

/* ---- SHARE ---- */
function copyLink(){
  navigator.clipboard.writeText(window.location.href).catch(()=>{});
  const btn = document.getElementById('copy-btn');
  btn.textContent = '✓ Copied!';
  setTimeout(() => btn.textContent = '🔗 Copy link', 2000);
}
function shareTwitter(title){ window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title+' — sujon.dev')}`, '_blank'); }
function shareLinkedIn(){ window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`, '_blank'); }

/* init */
renderGrid();