async function testSpotifyAuth() {
    const API_BASE_URL = process.env.TEST_API_BASE_URL || 'http://127.0.0.1:5000/api';
    const EXPECT_REDIRECT_URI =
        process.env.TEST_EXPECT_REDIRECT_URI || 'https://freq-backend-tunnel.loca.lt/api/spotify/callback';

    console.log('--- Testing Spotify OAuth Flow ---');
    console.log('API:', API_BASE_URL);

    // 1. Get the Spotify Login URL
    console.log('\n[1] Fetching Spotify Authorization URL from backend...');
    const res = await fetch(`${API_BASE_URL}/spotify/authorize`);
    const data = await res.json();

    if (!data.authorizeUrl) {
        console.error('❌ Failed to get Spotify auth url:', data);
        process.exitCode = 1;
        return;
    }

    const authUrl = new URL(data.authorizeUrl);
    console.log('✅ Received Auth URL!');
    console.log('  Base URL:', authUrl.origin + authUrl.pathname);
    console.log('  Client ID:', authUrl.searchParams.get('client_id'));
    console.log('  Redirect URI:', authUrl.searchParams.get('redirect_uri'));

    if (authUrl.searchParams.get('redirect_uri') === EXPECT_REDIRECT_URI) {
        console.log('✅ Redirect URI is correctly configured for LocalTunnel!');
    } else {
        console.log('❌ Redirect URI is incorrect. Found:', authUrl.searchParams.get('redirect_uri'));
        console.log('   Expected:', EXPECT_REDIRECT_URI);
        process.exitCode = 1;
    }
}

testSpotifyAuth().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
