/**
 * NIS Alumni — Profile JavaScript
 * Load profile data and handle settings form submission.
 */

// ── Toast helper (shared) ───────────────────────────────────
function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        toast.style.transition = '0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ── Get user ID from URL query string ───────────────────────
function getUserIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// ── Load profile data and fill the page ─────────────────────
async function loadProfile() {
    const userId = getUserIdFromURL();
    const url = userId ? `/api/profile.php?id=${userId}` : '/api/profile.php';

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (!data.success || !data.profile) {
            showToast('Could not load profile.', 'error');
            return;
        }

        const p = data.profile;

        // Fill display elements (profile.html)
        setTextById('profile-name', p.full_name || 'NIS Alumni');
        setTextById('profile-branch', p.nis_branch ? `NIS ${p.nis_branch}` : '');
        setTextById('profile-year', p.graduation_year ? `Class of ${p.graduation_year}` : '');
        setTextById('profile-university', p.university || '');
        setTextById('profile-degree', p.degree_major || '');
        setTextById('profile-bio', p.bio || 'No bio yet.');
        setTextById('profile-email', p.email || '');

        // Avatar
        const avatarEl = document.getElementById('profile-avatar');
        if (avatarEl && p.avatar_url) {
            avatarEl.src = p.avatar_url;
        }

        // Social links
        setSocialLink('link-linkedin', p.linkedin);
        setSocialLink('link-instagram', p.instagram);
        setSocialLink('link-youtube', p.youtube);

        // Fill form fields (settings.html)
        setValueById('input-full-name', p.full_name);
        setValueById('input-nis-branch', p.nis_branch);
        setValueById('input-graduation-year', p.graduation_year);
        setValueById('input-university', p.university);
        setValueById('input-degree-major', p.degree_major);
        setValueById('input-bio', p.bio);
        setValueById('input-linkedin', p.linkedin);
        setValueById('input-instagram', p.instagram);
        setValueById('input-youtube', p.youtube);

    } catch (err) {
        showToast('Network error loading profile.', 'error');
    }
}

// ── Helpers ──────────────────────────────────────────────────
function setTextById(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '';
}

function setValueById(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
}

function setSocialLink(id, url) {
    const el = document.getElementById(id);
    if (el) {
        if (url) {
            el.href = url.startsWith('http') ? url : `https://${url}`;
            el.style.display = '';
        } else {
            el.style.display = 'none';
        }
    }
}

// ── Settings form submission ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadProfile();

    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = settingsForm.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Saving…';

            const data = {
                full_name: settingsForm.full_name.value.trim(),
                nis_branch: settingsForm.nis_branch.value,
                graduation_year: settingsForm.graduation_year.value,
                university: settingsForm.university.value.trim(),
                degree_major: settingsForm.degree_major.value.trim(),
                bio: settingsForm.bio.value.trim(),
                linkedin: settingsForm.linkedin.value.trim(),
                instagram: settingsForm.instagram.value.trim(),
                youtube: settingsForm.youtube.value.trim(),
            };

            try {
                const res = await fetch('/api/profile.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                const result = await res.json();

                if (result.success) {
                    showToast('Profile updated!', 'success');
                } else {
                    showToast(result.message || 'Update failed.', 'error');
                }
            } catch (err) {
                showToast('Network error.', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Save Changes';
            }
        });
    }
});
