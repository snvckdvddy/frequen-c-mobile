async function testCreateSession() {
    const API_BASE_URL = process.env.TEST_API_BASE_URL || 'http://127.0.0.1:5000/api';
    const TEST_EMAIL = process.env.TEST_EMAIL || 'testbot@freq.local';
    const TEST_PASSWORD = process.env.TEST_PASSWORD || 'password123';

    const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });

    const loginData = await loginRes.json();
    if (loginData.status !== 'success') {
        console.error('Login failed:', loginData);
        process.exitCode = 1;
        return;
    }

    const token = loginData.data.token;

    const payload = {
        name: "Friday Night Vibes",
        genre: "Mixed",
        roomMode: "campfire",
        isPublic: true,
        behaviors: {
            queueOrdering: "roundRobin",
            skipAccess: "anyone",
            voteReordersQueue: false,
            requiresApproval: false,
            allowOverdrive: false,
            allowPhaseCancel: false,
            allowPhantomPower: false,
            forecastEnabled: false,
            duelEnabled: false
        }
    };

    try {
        const res = await fetch(`${API_BASE_URL}/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Response:", text);
    } catch (err) {
        console.error("Fetch failed:", err);
        process.exitCode = 1;
    }
}

testCreateSession().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
