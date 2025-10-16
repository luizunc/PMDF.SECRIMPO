const { ipcRenderer } = require('electron');

const occurrenceForm = document.getElementById('occurrenceForm');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const pngBtn = document.getElementById('pngBtn');
const logoutBtn = document.getElementById('logoutBtn');
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');
const userInfo = document.getElementById('userInfo');

// Carregar informações do usuário
window.addEventListener('load', () => {
    const username = sessionStorage.getItem('username');
    if (username) {
        userInfo.textContent = `Usuário: ${username}`;
    }

    // Definir data atual como padrão
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dataApreensao').value = today;
});

// Submit do formulário
occurrenceForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Coletar dados do formulário
    const formData = {
        ocorrencia: {
            numeroGenesis: document.getElementById('numeroGenesis').value,
            unidade: document.getElementById('unidade').value,
            dataApreensao: document.getElementById('dataApreensao').value,
            leiInfrigida: document.getElementById('leiInfrigida').value,
            artigo: document.getElementById('artigo').value,
            policialCondutor: document.getElementById('policialCondutor').value
        },
        itemApreendido: {
            especie: document.getElementById('especie').value,
            item: document.getElementById('item').value,
            quantidade: document.getElementById('quantidade').value,
            valor: document.getElementById('valor').value,
            peso: document.getElementById('peso').value,
            numeroSerie: document.getElementById('numeroSerie').value,
            descricao: document.getElementById('descricaoItem').value,
            ocorrencia: document.getElementById('ocorrenciaItem').value,
            proprietario: document.getElementById('proprietarioItem').value,
            policial: document.getElementById('policialItem').value
        },
        proprietario: {
            nome: document.getElementById('nomeProprietario').value,
            dataNascimento: document.getElementById('dataNascimento').value,
            tipoDocumento: document.getElementById('tipoDocumento').value,
            numeroDocumento: document.getElementById('numeroDocumento').value
        },
        policial: {
            nome: document.getElementById('nomePolicial').value,
            matricula: document.getElementById('matricula').value,
            graduacao: document.getElementById('graduacao').value,
            unidade: document.getElementById('unidadePolicial').value
        },
        metadata: {
            registradoPor: sessionStorage.getItem('username'),
            dataRegistro: new Date().toISOString()
        }
    };

    // Desabilitar botão e mostrar loading
    setLoading(true);
    hideMessages();

    try {
        const result = await ipcRenderer.invoke('save-occurrence', formData);

        if (result.success) {
            showSuccess(result.message);
            // Limpar formulário após sucesso
            setTimeout(() => {
                clearForm();
            }, 2000);
        } else {
            showError(result.message || 'Erro ao salvar ocorrência');
        }
    } catch (error) {
        console.error('Erro ao salvar:', error);
        showError('Erro ao salvar ocorrência: ' + error.message);
    } finally {
        setLoading(false);
    }
});

// Limpar formulário
clearBtn.addEventListener('click', () => {
    if (confirm('Deseja realmente limpar todos os campos do formulário?')) {
        clearForm();
    }
});

// Salvar PNG
pngBtn.addEventListener('click', async () => {
    // Verificar se há dados no formulário
    const numeroGenesis = document.getElementById('numeroGenesis').value;
    if (!numeroGenesis.trim()) {
        showError('Preencha pelo menos o número Genesis para gerar o PNG');
        return;
    }

    // Coletar dados do formulário
    const formData = {
        ocorrencia: {
            numeroGenesis: document.getElementById('numeroGenesis').value,
            unidade: document.getElementById('unidade').value,
            dataApreensao: document.getElementById('dataApreensao').value,
            leiInfrigida: document.getElementById('leiInfrigida').value,
            artigo: document.getElementById('artigo').value,
            policialCondutor: document.getElementById('policialCondutor').value
        },
        itemApreendido: {
            especie: document.getElementById('especie').value,
            item: document.getElementById('item').value,
            quantidade: document.getElementById('quantidade').value,
            valor: document.getElementById('valor').value,
            peso: document.getElementById('peso').value,
            numeroSerie: document.getElementById('numeroSerie').value,
            descricao: document.getElementById('descricaoItem').value,
            ocorrencia: document.getElementById('ocorrenciaItem').value,
            proprietario: document.getElementById('proprietarioItem').value,
            policial: document.getElementById('policialItem').value
        },
        proprietario: {
            nome: document.getElementById('nomeProprietario').value,
            dataNascimento: document.getElementById('dataNascimento').value,
            tipoDocumento: document.getElementById('tipoDocumento').value,
            numeroDocumento: document.getElementById('numeroDocumento').value
        },
        policial: {
            nome: document.getElementById('nomePolicial').value,
            matricula: document.getElementById('matricula').value,
            graduacao: document.getElementById('graduacao').value,
            unidade: document.getElementById('unidadePolicial').value
        },
        metadata: {
            registradoPor: sessionStorage.getItem('username'),
            dataRegistro: new Date().toISOString()
        }
    };

    // Desabilitar botão e mostrar loading
    setPngLoading(true);
    hideMessages();

    try {
        const result = await ipcRenderer.invoke('generate-png', formData);

        if (result.success) {
            showSuccess(`PNG salvo com sucesso: ${result.filename}`);
        } else {
            showError(result.message || 'Erro ao gerar PNG');
        }
    } catch (error) {
        console.error('Erro ao gerar PNG:', error);
        showError('Erro ao gerar PNG: ' + error.message);
    } finally {
        setPngLoading(false);
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    if (confirm('Deseja realmente sair do sistema?')) {
        sessionStorage.clear();
        ipcRenderer.send('logout');
    }
});

// Funções auxiliares
function setLoading(loading) {
    submitBtn.disabled = loading;
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');

    if (loading) {
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline-block';
    } else {
        btnText.style.display = 'inline-block';
        btnLoader.style.display = 'none';
    }
}

function setPngLoading(loading) {
    pngBtn.disabled = loading;
    const btnText = pngBtn.querySelector('.btn-text');
    const btnLoader = pngBtn.querySelector('.btn-loader');

    if (loading) {
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline-block';
    } else {
        btnText.style.display = 'inline-block';
        btnLoader.style.display = 'none';
    }
}

function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    successMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideMessages() {
    successMessage.style.display = 'none';
    errorMessage.style.display = 'none';
}

function clearForm() {
    occurrenceForm.reset();
    hideMessages();

    // Redefinir data atual
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dataApreensao').value = today;

    // Focar no primeiro campo
    document.getElementById('numeroGenesis').focus();
}

// Máscaras para campos
document.getElementById('numeroDocumento').addEventListener('input', function (e) {
    const tipo = document.getElementById('tipoDocumento').value;
    let value = e.target.value.replace(/\D/g, '');

    if (tipo === 'CPF' && value.length <= 11) {
        value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (tipo === 'RG' && value.length <= 9) {
        value = value.replace(/(\d{2})(\d{3})(\d{3})(\d{1})/, '$1.$2.$3-$4');
    }

    e.target.value = value;
});

// Validação de quantidade
document.getElementById('quantidade').addEventListener('input', function (e) {
    if (e.target.value < 1) {
        e.target.value = 1;
    }
});

// Máscara para valor monetário
document.getElementById('valor').addEventListener('input', function (e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 0) {
        value = (parseInt(value) / 100).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
        e.target.value = value;
    }
});