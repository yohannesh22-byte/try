const app = {
    token: localStorage.getItem('token'),
    role: localStorage.getItem('role'),
    html5QrCode: null,

    init() {
        this.bindEvents();
        if (this.token) {
            this.showScreen('role-selection');
        } else {
            this.showScreen('login-screen');
        }
    },

    bindEvents() {
        document.getElementById('login-form').onsubmit = (e) => this.handleLogin(e);
        document.getElementById('add-product-form').onsubmit = (e) => this.handleAddProduct(e);
    },

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
        if (id !== 'worker-view' && this.html5QrCode) {
            this.html5QrCode.stop().catch(() => {});
        }
    },

    async handleLogin(e) {
        e.preventDefault();
        const username = e.target[0].value;
        const password = e.target[1].value;
        
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (res.ok) {
                this.token = data.token;
                this.role = data.role;
                localStorage.setItem('token', data.token);
                localStorage.setItem('role', data.role);
                this.showScreen('role-selection');
            } else {
                document.getElementById('login-error').innerText = data.error;
            }
        } catch (err) {
            console.error(err);
        }
    },

    logout() {
        localStorage.clear();
        location.reload();
    },

    showWorker() {
        this.showScreen('worker-view');
        this.startScanner();
    },

    requestOwnerAccess() {
        if (this.role !== 'owner') {
            alert("Access Denied: Owner privileges required.");
            return;
        }
        document.getElementById('pin-modal').classList.remove('hidden');
    },

    closePinModal() {
        document.getElementById('pin-modal').classList.add('hidden');
        document.getElementById('owner-pin').value = '';
    },

    async verifyPin() {
        const pin = document.getElementById('owner-pin').value;
        try {
            const res = await fetch('/api/verify-pin', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ pin })
            });
            if (res.ok) {
                this.closePinModal();
                this.showOwnerDashboard();
            } else {
                alert("Invalid PIN");
            }
        } catch (err) {
            console.error(err);
        }
    },

    async showOwnerDashboard() {
        this.showScreen('owner-view');
        this.loadInventory();
    },

    async loadInventory() {
        const res = await fetch('/api/inventory', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        const items = await res.json();
        const body = document.getElementById('inventory-body');
        body.innerHTML = '';
        
        items.forEach(item => {
            const statusClass = item.quantity === 0 ? 'badge-red' : (item.quantity <= 5 ? 'badge-orange' : 'badge-green');
            const statusText = item.quantity === 0 ? 'Out of Stock' : (item.quantity <= 5 ? 'Low Stock' : 'In Stock');
            
            body.innerHTML += `
                <tr>
                    <td>${item.barcode}</td>
                    <td>${item.product_name}</td>
                    <td>${item.quantity}</td>
                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                </tr>
            `;
        });
    },

    startScanner() {
        this.html5QrCode = new Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        this.html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => {
            this.handleScan(decodedText);
        });
    },

    async handleScan(barcode) {
        const status = document.getElementById('scan-result');
        status.innerText = `Processing: ${barcode}...`;
        
        try {
            const res = await fetch('/api/scan-checkout', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ barcode })
            });
            const data = await res.json();
            if (res.ok) {
                status.innerText = `SUCCESS: ${data.item.product_name} sold!`;
                status.style.color = 'var(--success)';
            } else {
                status.innerText = `ERROR: ${data.error}`;
                status.style.color = 'var(--error)';
            }
        } catch (err) {
            status.innerText = "Network Error";
        }
        
        setTimeout(() => {
            status.innerText = "Ready to scan...";
            status.style.color = 'white';
        }, 3000);
    },

    showScannerFromOwner() {
        this.showWorker();
    },

    showAddProductModal() {
        document.getElementById('add-product-modal').classList.remove('hidden');
    },

    closeAddProductModal() {
        document.getElementById('add-product-modal').classList.add('hidden');
    },

    async handleAddProduct(e) {
        e.preventDefault();
        const product = {
            barcode: document.getElementById('new-barcode').value,
            product_name: document.getElementById('new-name').value,
            quantity: parseInt(document.getElementById('new-qty').value),
            description: document.getElementById('new-desc').value
        };

        const res = await fetch('/api/inventory', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify(product)
        });

        if (res.ok) {
            this.closeAddProductModal();
            this.loadInventory();
        } else {
            const data = await res.json();
            alert(data.error);
        }
    }
};

app.init();
