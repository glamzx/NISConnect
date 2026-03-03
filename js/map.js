/**
 * NIS Alumni — Map JavaScript
 * Google Maps integration with geolocation, custom markers, and user popups.
 */

let map;
let infoWindow;
let userMarkers = [];

/**
 * Initializes the Google Map (called by the Maps API callback).
 */
function initMap() {
    // Premium dark map style
    const mapStyles = [
        { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
        { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
        { featureType: 'land', elementType: 'geometry', stylers: [{ color: '#1B2D4F' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
        { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
        { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
        { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
        { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
        { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#023e58' }] },
        { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
    ];

    // Default center: Astana, Kazakhstan
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 51.1694, lng: 71.4491 },
        zoom: 5,
        styles: mapStyles,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
    });

    infoWindow = new google.maps.InfoWindow();

    // Request user geolocation
    requestGeolocation();

    // Load all alumni markers
    loadAlumniLocations();
}

/**
 * Request browser geolocation and send it to the server.
 */
function requestGeolocation() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            // Center map on user
            map.setCenter({ lat, lng });
            map.setZoom(10);

            // Post location to server
            try {
                await fetch('/api/location.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ latitude: lat, longitude: lng }),
                });
            } catch (err) {
                console.warn('Could not save location:', err);
            }
        },
        (error) => {
            console.warn('Geolocation denied or unavailable:', error.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

/**
 * Fetch all alumni locations and render markers on the map.
 */
async function loadAlumniLocations() {
    try {
        const res = await fetch('/api/location.php');
        const data = await res.json();

        if (!data.success || !data.locations) return;

        // Clear existing markers
        userMarkers.forEach(m => m.setMap(null));
        userMarkers = [];

        data.locations.forEach(user => {
            const marker = new google.maps.Marker({
                position: { lat: parseFloat(user.latitude), lng: parseFloat(user.longitude) },
                map: map,
                title: user.full_name,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: '#C8FF00',
                    fillOpacity: 1,
                    strokeColor: '#0B1D3A',
                    strokeWeight: 2,
                },
            });

            // Mini preview popup
            const initials = (user.full_name || '?')
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

            const avatar = user.avatar_url
                ? `<img src="${user.avatar_url}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;margin-bottom:8px;" />`
                : `<div style="width:48px;height:48px;border-radius:50%;background:#0B1D3A;color:#C8FF00;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;margin-bottom:8px;">${initials}</div>`;

            const content = `
        <div class="marker-popup">
          ${avatar}
          <h4>${user.full_name || 'Anonymous'}</h4>
          <p>${user.nis_branch ? `NIS ${user.nis_branch}` : ''} ${user.graduation_year ? `'${String(user.graduation_year).slice(-2)}` : ''}</p>
          <a href="/profile.html?id=${user.user_id}" 
             style="color:#0B1D3A;font-weight:600;font-size:0.85rem;text-decoration:underline;">
            View Profile →
          </a>
        </div>
      `;

            marker.addListener('click', () => {
                infoWindow.setContent(content);
                infoWindow.open(map, marker);
            });

            userMarkers.push(marker);
        });

        // Update count badge
        const badge = document.getElementById('alumni-count');
        if (badge) badge.textContent = data.locations.length;

    } catch (err) {
        console.error('Failed to load alumni locations:', err);
    }
}

// ── Sidebar filter ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const filterSelect = document.getElementById('branch-filter');
    if (filterSelect) {
        filterSelect.addEventListener('change', () => {
            const branch = filterSelect.value.toLowerCase();
            userMarkers.forEach(m => {
                const title = (m.getTitle() || '').toLowerCase();
                // Simple show/hide – in production, filter by branch data
                m.setVisible(branch === '' || true);
            });
        });
    }
});
