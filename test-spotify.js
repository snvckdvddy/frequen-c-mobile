async function testSpotifyPlumbing() {
    const API_BASE_URL = process.env.TEST_API_BASE_URL || 'http://127.0.0.1:5000/api';
    const TEST_EMAIL = process.env.TEST_EMAIL || 'integrationbot@freq.local';
    const TEST_USERNAME = process.env.TEST_USERNAME || 'integrationbot';
    const TEST_PASSWORD = process.env.TEST_PASSWORD || 'password123';

    console.log('--- Testing Spotify Integration Plumbing ---');
    console.log('API:', API_BASE_URL);

    // Ensure test account exists
    const registerRes = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: TEST_USERNAME, email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    if (![201, 409].includes(registerRes.status)) {
        console.error('❌ Register failed:', registerRes.status, await registerRes.text());
        process.exitCode = 1;
        return;
    }

    // Login
    const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.token) {
        console.error('❌ Login failed:', loginRes.status, loginData);
        process.exitCode = 1;
        return;
    }
    const token = loginData.token;

    // Validate /auth/me shape exposes connectedServices.spotify
    const meRes = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const meData = await meRes.json();
    const spotifyShapeOk = !!meData?.user?.connectedServices?.spotify;
    if (!meRes.ok || !spotifyShapeOk) {
        console.error('❌ /auth/me missing connectedServices.spotify:', meData);
        process.exitCode = 1;
        return;
    }
    console.log('✅ /auth/me contains connectedServices.spotify');

    // Validate Spotify search route is reachable.
    // 200 if connected, 403 "Spotify not connected" if not connected — both mean route is wired.
    const searchRes = await fetch(`${API_BASE_URL}/search/tracks?q=test`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const searchText = await searchRes.text();

    if (searchRes.status === 200) {
        console.log('✅ Spotify search route reachable and connected (200).');
        return;
    }

    if (searchRes.status === 403 && searchText.includes('Spotify not connected')) {
        console.log('✅ Spotify search route reachable (403 not connected is expected without OAuth link).');
        return;
    }

    console.error('❌ Unexpected Spotify search response:', searchRes.status, searchText);
    process.exitCode = 1;
}

testSpotifyPlumbing().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});

