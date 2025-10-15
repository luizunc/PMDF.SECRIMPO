const { ipcRenderer } = require('electron');

const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const errorMessage = document.getElementById('errorMessage');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (!username || !password) {
        showError('Por favor, preencha todos os campos');
        return;
    }
    
    // Desabilitar botão e mostrar loading
    setLoading(true);
    hideError();
    
    try {
        // Chamar autenticação via Python/KeyAuth
        const result = await ipcRenderer.invoke('authenticate', username, password);
        
        if (result.success) {
            // Salvar informações do usuário (se necessário)
            sessionStorage.setItem('username', username);
            if (result.userData) {
                sessionStorage.setItem('userData', JSON.stringify(result.userData));
            }
            
            // Carregar painel principal
            ipcRenderer.send('load-panel');
        } else {
            showError(result.message || 'Falha na autenticação. Verifique suas credenciais.');
            setLoading(false);
        }
    } catch (error) {
        console.error('Erro na autenticação:', error);
        showError(error.message || 'Erro ao conectar com o servidor de autenticação.');
        setLoading(false);
    }
});

function setLoading(loading) {
    loginBtn.disabled = loading;
    const btnText = loginBtn.querySelector('.btn-text');
    const btnLoader = loginBtn.querySelector('.btn-loader');
    
    if (loading) {
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline-block';
    } else {
        btnText.style.display = 'inline-block';
        btnLoader.style.display = 'none';
    }
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

function hideError() {
    errorMessage.style.display = 'none';
}

// Limpar campos ao carregar
window.addEventListener('load', () => {
    usernameInput.value = '';
    passwordInput.value = '';
    usernameInput.focus();
});
