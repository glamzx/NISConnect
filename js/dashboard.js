/**
 * NIS Alumni — Dashboard JavaScript
 * Powers: navigation, feed, alumni directory, map, profile, settings.
 */

// ── State ──────────────────────────────────────────────────
let currentSection = 'feed';
let currentUser = null;
let profileUserId = null;   // whose profile we're viewing
let feedPage = 1;
let alumniPage = 1;
let feedHasMore = false;
let alumniHasMore = false;
let map = null;
let mapMarkers = [];
let pendingFiles = [];

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await checkSession();
    setupAvatarDropdown();
    setupPostComposer();
    setupAlumniControls();
    setupSettings();
    setupAvatarUpload();
    setupSearch();

    // Navigate to section from URL hash or default to feed
    const hash = location.hash.replace('#', '') || 'feed';
    navigateTo(hash);
});

// ── Session Check ──────────────────────────────────────────
async function checkSession() {
    try {
        const res = await fetch('api/session.php');
        const data = await res.json();
        if (!data.logged_in) {
            window.location.href = 'login.html';
            return;
        }
        currentUser = data;
        updateNavAvatar(data);
    } catch {
        // If API fails (e.g. file:// protocol), use placeholder
        currentUser = { user_id: 1, full_name: 'Guest', avatar_url: null, logged_in: true };
    }
}

function updateNavAvatar(user) {
    const avatarUrl = user.avatar_url
        ? user.avatar_url
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=C8FF00&color=0B1D3A&size=36&bold=true&font-size=0.45`;

    document.getElementById('nav-avatar').src = avatarUrl;
    document.getElementById('composer-avatar').src = avatarUrl;
    document.getElementById('dropdown-name').textContent = user.full_name;
}

// ── Avatar Dropdown ────────────────────────────────────────
function setupAvatarDropdown() {
    const btn = document.getElementById('avatar-btn');
    const dropdown = document.getElementById('avatar-dropdown');

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', () => dropdown.classList.add('hidden'));
}

// ── Navigation ─────────────────────────────────────────────
function navigateTo(section, userId) {
    // Hide all sections
    document.querySelectorAll('.page-section').forEach(s => s.classList.add('hidden'));

    // Show target
    const el = document.getElementById(`section-${section}`);
    if (el) el.classList.remove('hidden');

    // Update active nav
    document.querySelectorAll('[data-nav]').forEach(btn => {
        btn.classList.remove('bg-accent/10', 'text-navy', '!text-navy');
        btn.classList.add('text-gray-600', 'text-gray-400');
    });
    document.querySelectorAll(`[data-nav="${section}"]`).forEach(btn => {
        btn.classList.add('bg-accent/10', '!text-navy');
        btn.classList.remove('text-gray-600', 'text-gray-400');
    });

    location.hash = section;
    currentSection = section;

    // Load section data
    switch (section) {
        case 'feed':
            feedPage = 1;
            loadPosts(true);
            break;
        case 'alumni':
            alumniPage = 1;
            loadAlumni(true);
            break;
        case 'map':
            loadGoogleMaps();
            break;
        case 'profile':
            profileUserId = userId || currentUser?.user_id;
            loadProfile(profileUserId);
            break;
        case 'settings':
            loadSettings();
            break;
    }

    lucide.createIcons();
}

// ══════════════════════════════════════════════════════════
//  FEED — Posts
// ══════════════════════════════════════════════════════════
function setupPostComposer() {
    const submitBtn = document.getElementById('post-submit');
    const fileInput = document.getElementById('post-file');
    const attachInput = document.getElementById('post-attachment');
    const preview = document.getElementById('file-preview');

    submitBtn?.addEventListener('click', createPost);

    // File preview
    [fileInput, attachInput].forEach(input => {
        input?.addEventListener('change', () => {
            const files = Array.from(input.files);
            pendingFiles = [...pendingFiles, ...files];
            renderFilePreview();
        });
    });
}

function renderFilePreview() {
    const preview = document.getElementById('file-preview');
    if (!pendingFiles.length) {
        preview.classList.add('hidden');
        preview.innerHTML = '';
        return;
    }
    preview.classList.remove('hidden');
    preview.innerHTML = pendingFiles.map((f, i) => {
        if (f.type.startsWith('image/')) {
            return `<div class="relative group">
        <img src="${URL.createObjectURL(f)}" class="w-16 h-16 rounded-lg object-cover border border-gray-200" />
        <button onclick="removeFile(${i})" class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition">×</button>
      </div>`;
        }
        return `<div class="relative group flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-600">
      📎 ${f.name}
      <button onclick="removeFile(${i})" class="text-red-500 ml-1">×</button>
    </div>`;
    }).join('');
}

function removeFile(index) {
    pendingFiles.splice(index, 1);
    renderFilePreview();
}

async function createPost() {
    const content = document.getElementById('post-content').value.trim();
    if (!content && !pendingFiles.length) return;

    const submitBtn = document.getElementById('post-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Publishing…';

    try {
        // Upload attachments first
        const uploadedFiles = [];
        for (const file of pendingFiles) {
            const fd = new FormData();
            fd.append('file', file);
            const uploadRes = await fetch('api/upload.php?type=attachment', { method: 'POST', body: fd });
            const uploadData = await uploadRes.json();
            if (uploadData.success) {
                uploadedFiles.push({
                    file_path: uploadData.file_path,
                    file_type: uploadData.file_type,
                    original_name: uploadData.original_name,
                });
            }
        }

        // Create post
        const res = await fetch('api/posts.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, attachments: uploadedFiles }),
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('post-content').value = '';
            pendingFiles = [];
            renderFilePreview();
            feedPage = 1;
            loadPosts(true);
            showToast('Post published!', 'success');
        } else {
            showToast(data.message || 'Failed to post.', 'error');
        }
    } catch (err) {
        showToast('Network error.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publish';
    }
}

async function loadPosts(reset = false) {
    if (reset) feedPage = 1;
    try {
        const res = await fetch(`api/posts.php?page=${feedPage}`);
        const data = await res.json();
        if (!data.success) return;

        const container = document.getElementById('posts-list');
        if (reset) container.innerHTML = '';

        if (data.posts.length === 0 && reset) {
            container.innerHTML = `<div class="text-center py-12 text-gray-400">
        <p>No posts yet. Be the first to share!</p>
      </div>`;
        }

        data.posts.forEach(post => container.appendChild(createPostCard(post)));

        feedHasMore = feedPage < data.pages;
        document.getElementById('feed-load-more').classList.toggle('hidden', !feedHasMore);
        feedPage++;

        lucide.createIcons();
    } catch { }
}

function createPostCard(post) {
    const div = document.createElement('div');
    div.className = 'bg-white rounded-2xl border border-gray-200 p-5 shadow-sm';

    const avatarUrl = post.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.full_name)}&background=C8FF00&color=0B1D3A&size=40&bold=true&font-size=0.45`;
    const timeAgo = formatTimeAgo(post.created_at);

    let attachHtml = '';
    if (post.attachments?.length) {
        attachHtml = '<div class="flex flex-wrap gap-2 mt-3">' +
            post.attachments.map(att => {
                if (att.file_type === 'image') {
                    return `<img src="${att.file_path}" class="rounded-lg max-h-64 object-cover cursor-pointer hover:opacity-90 transition" onclick="window.open('${att.file_path}','_blank')" />`;
                }
                return `<a href="${att.file_path}" target="_blank" class="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-600 hover:bg-gray-200 transition">📎 ${att.original_name || 'File'}</a>`;
            }).join('') + '</div>';
    }

    const deleteBtn = (post.user_id == currentUser?.user_id)
        ? `<button onclick="deletePost(${post.id}, this)" class="text-gray-300 hover:text-red-500 transition ml-auto"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`
        : '';

    div.innerHTML = `
    <div class="flex items-start gap-3">
      <img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover shrink-0 cursor-pointer" onclick="navigateTo('profile',${post.user_id})" />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <a onclick="navigateTo('profile',${post.user_id})" class="font-semibold text-sm text-navy hover:underline cursor-pointer">${escHtml(post.full_name)}</a>
          <span class="text-xs text-gray-400">${post.nis_branch || ''}</span>
          <span class="text-xs text-gray-300">·</span>
          <span class="text-xs text-gray-400">${timeAgo}</span>
          ${deleteBtn}
        </div>
        <p class="text-sm text-gray-700 mt-2 whitespace-pre-wrap leading-relaxed">${escHtml(post.content)}</p>
        ${attachHtml}
      </div>
    </div>
  `;
    return div;
}

async function deletePost(postId, btn) {
    if (!confirm('Delete this post?')) return;
    try {
        const res = await fetch(`api/posts.php?id=${postId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            btn.closest('.bg-white').remove();
            showToast('Post deleted.', 'success');
        }
    } catch { }
}

// ══════════════════════════════════════════════════════════
//  ALUMNI DIRECTORY
// ══════════════════════════════════════════════════════════
function setupAlumniControls() {
    let debouncedTimer;

    document.getElementById('alumni-search')?.addEventListener('input', () => {
        clearTimeout(debouncedTimer);
        debouncedTimer = setTimeout(() => { alumniPage = 1; loadAlumni(true); }, 300);
    });

    document.getElementById('alumni-sort')?.addEventListener('change', () => {
        alumniPage = 1;
        loadAlumni(true);
    });
}

async function loadAlumni(reset = false) {
    if (reset) alumniPage = 1;

    const search = document.getElementById('alumni-search')?.value || '';
    const sort = document.getElementById('alumni-sort')?.value || 'name';

    try {
        const res = await fetch(`api/users.php?sort=${sort}&q=${encodeURIComponent(search)}&page=${alumniPage}`);
        const data = await res.json();
        if (!data.success) return;

        const grid = document.getElementById('alumni-grid');
        if (reset) grid.innerHTML = '';

        if (data.users.length === 0 && reset) {
            grid.innerHTML = `<div class="text-center py-12 text-gray-400 col-span-full">
        <p>No alumni found.</p>
      </div>`;
        }

        data.users.forEach(user => grid.appendChild(createAlumniCard(user)));

        alumniHasMore = alumniPage < data.pages;
        document.getElementById('alumni-load-more').classList.toggle('hidden', !alumniHasMore);
        alumniPage++;

        lucide.createIcons();
    } catch { }
}

function createAlumniCard(user) {
    const div = document.createElement('div');
    div.className = 'bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer';

    const avatarUrl = user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=C8FF00&color=0B1D3A&size=48&bold=true&font-size=0.45`;
    const isFollowing = user.is_following > 0;
    const isMe = user.id == currentUser?.user_id;

    const followBtn = isMe ? '' :
        `<button onclick="event.stopPropagation(); toggleFollowUser(${user.id}, this)"
       class="mt-3 w-full py-2 rounded-full text-xs font-semibold transition ${isFollowing
            ? 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500'
            : 'bg-navy text-white hover:bg-navy-light'}"
       data-following="${isFollowing ? '1' : '0'}">
       ${isFollowing ? 'Following' : 'Follow'}
     </button>`;

    div.setAttribute('onclick', `navigateTo('profile', ${user.id})`);

    div.innerHTML = `
    <div class="flex items-center gap-3">
      <img src="${avatarUrl}" class="w-12 h-12 rounded-full object-cover shrink-0" />
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-sm text-navy truncate">${escHtml(user.full_name)}</p>
        <p class="text-xs text-gray-400 truncate">${user.nis_branch || ''} ${user.graduation_year ? `'${String(user.graduation_year).slice(2)}` : ''}</p>
        ${user.university ? `<p class="text-xs text-gray-400 truncate mt-0.5">${escHtml(user.university)}</p>` : ''}
      </div>
    </div>
    ${followBtn}
  `;
    return div;
}

async function toggleFollowUser(userId, btn) {
    const isFollowing = btn.dataset.following === '1';

    try {
        if (isFollowing) {
            await fetch('api/subscriptions.php', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_id: userId }),
            });
            btn.dataset.following = '0';
            btn.textContent = 'Follow';
            btn.className = 'mt-3 w-full py-2 rounded-full text-xs font-semibold transition bg-navy text-white hover:bg-navy-light';
        } else {
            await fetch('api/subscriptions.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_id: userId }),
            });
            btn.dataset.following = '1';
            btn.textContent = 'Following';
            btn.className = 'mt-3 w-full py-2 rounded-full text-xs font-semibold transition bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500';
        }
    } catch { }
}

// ══════════════════════════════════════════════════════════
//  MAP (Google Maps — mutual only)
// ══════════════════════════════════════════════════════════
function initDashboardMap() {
    const mapEl = document.getElementById('google-map');
    if (!mapEl) return;

    map = new google.maps.Map(mapEl, {
        center: { lat: 51.1694, lng: 71.4491 }, // Astana
        zoom: 5,
        styles: [
            { elementType: 'geometry', stylers: [{ color: '#0B1D3A' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#0B1D3A' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#6B7280' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#071428' }] },
            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#15325E' }] },
        ],
        disableDefaultUI: true,
        zoomControl: true,
    });

    loadMapMarkers();

    // Share own location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            fetch('api/location.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            }).then(() => loadMapMarkers());
        });
    }
}

async function loadMapMarkers() {
    try {
        const res = await fetch('api/location.php');
        const data = await res.json();
        if (!data.success) return;

        // Clear old markers
        mapMarkers.forEach(m => m.setMap(null));
        mapMarkers = [];

        document.getElementById('map-alumni-count').textContent = data.locations.length;

        data.locations.forEach(loc => {
            const marker = new google.maps.Marker({
                position: { lat: parseFloat(loc.latitude), lng: parseFloat(loc.longitude) },
                map: map,
                title: loc.full_name,
                icon: {
                    url: 'assets/marker.svg',
                    scaledSize: new google.maps.Size(36, 36),
                },
            });

            const avatarUrl = loc.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(loc.full_name)}&background=C8FF00&color=0B1D3A&size=40&bold=true&font-size=0.45`;
            const infoWindow = new google.maps.InfoWindow({
                content: `<div style="font-family:Inter,sans-serif;padding:4px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <img src="${avatarUrl}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;" />
            <div>
              <strong style="font-size:13px;color:#0B1D3A;">${escHtml(loc.full_name)}</strong>
              <p style="font-size:11px;color:#9CA3AF;margin:0;">${loc.nis_branch || ''} ${loc.graduation_year || ''}</p>
            </div>
          </div>
        </div>`,
            });

            marker.addListener('click', () => infoWindow.open(map, marker));
            mapMarkers.push(marker);
        });
    } catch { }
}

// ══════════════════════════════════════════════════════════
//  PROFILE / WALL
// ══════════════════════════════════════════════════════════
async function loadProfile(userId) {
    if (!userId) return;

    try {
        // Load profile data
        const res = await fetch(`api/profile.php?user_id=${userId}`);
        const data = await res.json();
        if (!data.success) return;

        const u = data.user;
        const avatarUrl = u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name)}&background=C8FF00&color=0B1D3A&size=96&bold=true&font-size=0.4`;

        document.getElementById('profile-avatar-img').src = avatarUrl;
        document.getElementById('profile-display-name').textContent = u.full_name || '—';
        document.getElementById('profile-display-branch').textContent = u.nis_branch || '';
        document.getElementById('profile-display-year').textContent = u.graduation_year ? `'${String(u.graduation_year).slice(2)}` : '';
        document.getElementById('profile-display-bio').textContent = u.bio || '—';
        document.getElementById('profile-display-uni').textContent = u.university || '—';
        document.getElementById('profile-display-degree').textContent = u.degree_major || '—';
        document.getElementById('profile-display-email').textContent = u.email || '—';

        // Social links
        toggleSocialLink('prof-linkedin', u.linkedin);
        toggleSocialLink('prof-instagram', u.instagram);
        toggleSocialLink('prof-youtube', u.youtube);

        // Follow button (hide for own profile)
        const followWrap = document.getElementById('profile-follow-wrap');
        if (userId != currentUser?.user_id) {
            followWrap.classList.remove('hidden');
            loadFollowStatus(userId);
        } else {
            followWrap.classList.add('hidden');
        }

        // Follower/following counts
        const subRes = await fetch(`api/subscriptions.php?user_id=${userId}`);
        const subData = await subRes.json();
        if (subData.success) {
            document.getElementById('profile-follower-count').textContent = subData.follower_count;
            document.getElementById('profile-following-count').textContent = subData.following_count;
        }

        // Load wall posts
        loadWallPosts(userId);

        lucide.createIcons();
    } catch { }
}

function toggleSocialLink(id, url) {
    const el = document.getElementById(id);
    if (!el) return;
    if (url) {
        el.href = url;
        el.classList.remove('hidden');
    } else {
        el.classList.add('hidden');
    }
}

async function loadFollowStatus(userId) {
    try {
        const res = await fetch(`api/subscriptions.php?user_id=${userId}`);
        const data = await res.json();
        const btn = document.getElementById('profile-follow-btn');
        btn.dataset.userId = userId;

        if (data.i_follow) {
            btn.textContent = data.is_mutual ? '✓ Mutual' : 'Following';
            btn.className = 'px-5 py-2 rounded-full text-sm font-semibold transition bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500';
            btn.dataset.following = '1';
        } else {
            btn.textContent = 'Follow';
            btn.className = 'px-5 py-2 rounded-full text-sm font-semibold transition bg-navy text-white hover:bg-navy-light';
            btn.dataset.following = '0';
        }
    } catch { }
}

async function toggleFollow() {
    const btn = document.getElementById('profile-follow-btn');
    const userId = btn.dataset.userId;
    const isFollowing = btn.dataset.following === '1';

    try {
        if (isFollowing) {
            await fetch('api/subscriptions.php', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_id: parseInt(userId) }),
            });
        } else {
            await fetch('api/subscriptions.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_id: parseInt(userId) }),
            });
        }

        loadFollowStatus(userId);
        // Reload follower count
        const subRes = await fetch(`api/subscriptions.php?user_id=${userId}`);
        const subData = await subRes.json();
        if (subData.success) {
            document.getElementById('profile-follower-count').textContent = subData.follower_count;
        }
    } catch { }
}

async function loadWallPosts(userId) {
    try {
        const res = await fetch(`api/posts.php?user_id=${userId}`);
        const data = await res.json();
        const container = document.getElementById('wall-posts');
        container.innerHTML = '';

        if (!data.posts?.length) {
            container.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">No posts yet.</div>';
            return;
        }

        data.posts.forEach(post => container.appendChild(createPostCard(post)));
        lucide.createIcons();
    } catch { }
}

// ══════════════════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════════════════
function setupSettings() {
    document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            full_name: document.getElementById('s-full-name').value.trim(),
            nis_branch: document.getElementById('s-nis-branch').value,
            graduation_year: document.getElementById('s-grad-year').value || null,
            university: document.getElementById('s-university').value.trim(),
            degree_major: document.getElementById('s-degree').value.trim(),
            bio: document.getElementById('s-bio').value.trim(),
            linkedin: document.getElementById('s-linkedin').value.trim(),
            instagram: document.getElementById('s-instagram').value.trim(),
            youtube: document.getElementById('s-youtube').value.trim(),
        };

        try {
            const res = await fetch('api/profile.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (data.success) {
                showToast('Settings saved!', 'success');
                // Update nav avatar name
                if (formData.full_name) {
                    currentUser.full_name = formData.full_name;
                    updateNavAvatar(currentUser);
                }
            } else {
                showToast(data.message || 'Error saving.', 'error');
            }
        } catch {
            showToast('Network error.', 'error');
        }
    });
}

async function loadSettings() {
    try {
        const res = await fetch(`api/profile.php?user_id=${currentUser?.user_id}`);
        const data = await res.json();
        if (!data.success) return;

        const u = data.user;
        document.getElementById('s-full-name').value = u.full_name || '';
        document.getElementById('s-nis-branch').value = u.nis_branch || '';
        document.getElementById('s-grad-year').value = u.graduation_year || '';
        document.getElementById('s-university').value = u.university || '';
        document.getElementById('s-degree').value = u.degree_major || '';
        document.getElementById('s-bio').value = u.bio || '';
        document.getElementById('s-linkedin').value = u.linkedin || '';
        document.getElementById('s-instagram').value = u.instagram || '';
        document.getElementById('s-youtube').value = u.youtube || '';

        const avatarUrl = u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name)}&background=C8FF00&color=0B1D3A&size=80&bold=true&font-size=0.4`;
        document.getElementById('settings-avatar-preview').src = avatarUrl;
    } catch { }
}

function setupAvatarUpload() {
    document.getElementById('avatar-upload')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const fd = new FormData();
        fd.append('file', file);

        try {
            const res = await fetch('api/upload.php?type=avatar', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.success) {
                document.getElementById('settings-avatar-preview').src = data.file_path;
                currentUser.avatar_url = data.file_path;
                updateNavAvatar(currentUser);
                showToast('Avatar updated!', 'success');
            } else {
                showToast(data.message || 'Upload failed.', 'error');
            }
        } catch {
            showToast('Upload error.', 'error');
        }
    });
}

// ══════════════════════════════════════════════════════════
//  GLOBAL SEARCH
// ══════════════════════════════════════════════════════════
function setupSearch() {
    const input = document.getElementById('global-search');
    let timer;
    input?.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            const q = input.value.trim();
            if (q.length >= 2) {
                navigateTo('alumni');
                document.getElementById('alumni-search').value = q;
                alumniPage = 1;
                loadAlumni(true);
            }
        }, 400);
    });
}

// ══════════════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════════════
function escHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function formatTimeAgo(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function showToast(msg, type = 'success') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-xl text-sm font-medium shadow-lg transition-all duration-300 ${type === 'success' ? 'bg-navy text-white' : 'bg-red-500 text-white'
        }`;
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
