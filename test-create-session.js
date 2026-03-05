async function testCreateSession() {
    const API_BASE_URL = process.env.TEST_API_BASE_URL || 'http://127.0.0.1:5000/api';
    const TEST_EMAIL = process.env.TEST_EMAIL || 'integrationbot@freq.local';
    const TEST_USERNAME = process.env.TEST_USERNAME || 'integrationbot';
    const TEST_PASSWORD = process.env.TEST_PASSWORD || 'password123';

    // Ensure test account exists
    const registerRes = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: TEST_USERNAME, email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    if (![201, 409].includes(registerRes.status)) {
        const regData = await registerRes.json().catch(() => ({}));
        console.error('Register failed:', registerRes.status, regData);
        process.exitCode = 1;
        return;
    }

    const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });

    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.token) {
        console.error('Login failed:', loginRes.status, loginData);
        process.exitCode = 1;
        return;
    }

    const token = loginData.token;

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
