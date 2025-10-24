const { ipcRenderer } = require('electron');

const occurrenceForm = document.getElementById('occurrenceForm');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const logoutBtn = document.getElementById('logoutBtn');
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');
const userInfo = document.getElementById('userInfo');
const userMenuBtn = document.getElementById('userMenuBtn');
const userDropdown = document.getElementById('userDropdown');

// Navigation tabs
const tabDashboard = document.getElementById('tabDashboard');
const tabNovaOcorrencia = document.getElementById('tabNovaOcorrencia');

// Carregar informações do usuário
window.addEventListener('load', () => {
    const username = sessionStorage.getItem('username');
    if (username) {
        userInfo.textContent = `${username}`;
    }
    
    // Definir data atual como padrão no formato brasileiro
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    document.getElementById('dataApreensao').value = `${day}/${month}/${year}`;
});

// Submit do formulário
occurrenceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validar datas antes de enviar
    const dataApreensao = document.getElementById('dataApreensao').value;
    const dataNascimento = document.getElementById('dataNascimento').value;
    
    if (!isValidDate(dataApreensao)) {
        showError('Data de apreensão inválida. Use o formato dd/mm/aaaa');
        return;
    }
    
    if (!isValidDate(dataNascimento)) {
        showError('Data de nascimento inválida. Use o formato dd/mm/aaaa');
        return;
    }
    
    // Coletar dados do formulário
    const formData = {
        ocorrencia: {
            numeroGenesis: document.getElementById('numeroGenesis').value,
            unidade: document.getElementById('unidade').value,
            dataApreensao: brDateToISO(dataApreensao),
            leiInfrigida: document.getElementById('leiInfrigida').value,
            artigo: document.getElementById('artigo').value,
            policialCondutor: document.getElementById('policialCondutor').value
        },
        itemApreendido: {
            especie: document.getElementById('especie').value,
            item: document.getElementById('item').value,
            quantidade: document.getElementById('quantidade').value,
            unidadeMedida: document.getElementById('unidadeMedida').value,
            peso: document.getElementById('peso').value,
            descricao: document.getElementById('descricaoItem').value,
            ocorrencia: document.getElementById('ocorrenciaItem').value,
            proprietario: document.getElementById('proprietarioItem').value,
            policial: document.getElementById('policialItem').value,
            valor: document.getElementById('valorItem').value,
            numeroSerie: document.getElementById('numeroSerie').value
        },
        proprietario: {
            nome: document.getElementById('nomeProprietario').value,
            dataNascimento: brDateToISO(dataNascimento),
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

// Toggle do menu do usuário
userMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle('active');
});

// Fechar menu ao clicar fora
document.addEventListener('click', (e) => {
    if (!userDropdown.contains(e.target) && !userMenuBtn.contains(e.target)) {
        userDropdown.classList.remove('active');
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
    
    // Redefinir data atual no formato brasileiro
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    document.getElementById('dataApreensao').value = `${day}/${month}/${year}`;
    
    // Focar no primeiro campo
    document.getElementById('numeroGenesis').focus();
}

// Máscara para data no formato brasileiro (dd/mm/aaaa)
function applyDateMask(e) {
    let value = e.target.value.replace(/\D/g, '');
    
    if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2);
    }
    if (value.length >= 5) {
        value = value.substring(0, 5) + '/' + value.substring(5, 9);
    }
    
    e.target.value = value;
}

// Validar data no formato brasileiro
function isValidDate(dateString) {
    const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = dateString.match(regex);
    
    if (!match) return false;
    
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && 
           date.getMonth() === month - 1 && 
           date.getDate() === day;
}

// Converter data brasileira para ISO (yyyy-mm-dd)
function brDateToISO(brDate) {
    const [day, month, year] = brDate.split('/');
    return `${year}-${month}-${day}`;
}

// Aplicar máscaras nos campos de data
document.getElementById('dataApreensao').addEventListener('input', applyDateMask);
document.getElementById('dataNascimento').addEventListener('input', applyDateMask);

// Validação ao sair do campo de data
document.getElementById('dataApreensao').addEventListener('blur', function(e) {
    if (e.target.value && !isValidDate(e.target.value)) {
        showError('Data de apreensão inválida. Use o formato dd/mm/aaaa');
        e.target.focus();
    } else {
        hideMessages();
    }
});

document.getElementById('dataNascimento').addEventListener('blur', function(e) {
    if (e.target.value && !isValidDate(e.target.value)) {
        showError('Data de nascimento inválida. Use o formato dd/mm/aaaa');
        e.target.focus();
    } else {
        hideMessages();
    }
});

// Função para formatar CPF: 000.000.000-00
function formatCPF(value) {
    value = value.replace(/\D/g, '');
    if (value.length > 11) value = value.substring(0, 11);
    
    if (value.length <= 3) {
        return value;
    } else if (value.length <= 6) {
        return value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    } else if (value.length <= 9) {
        return value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    } else {
        return value.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    }
}

// Função para formatar RG: 0.000.000 (7 dígitos) ou 00.000.000-0 (9 dígitos)
function formatRG(value) {
    value = value.replace(/\D/g, '');
    if (value.length > 9) value = value.substring(0, 9);
    
    // Formato com 7 dígitos: 0.000.000
    if (value.length <= 7) {
        if (value.length <= 1) {
            return value;
        } else if (value.length <= 4) {
            return value.replace(/(\d{1})(\d{1,3})/, '$1.$2');
        } else {
            return value.replace(/(\d{1})(\d{3})(\d{1,3})/, '$1.$2.$3');
        }
    }
    // Formato com 8-9 dígitos: 00.000.000-0
    else {
        if (value.length <= 2) {
            return value;
        } else if (value.length <= 5) {
            return value.replace(/(\d{2})(\d{1,3})/, '$1.$2');
        } else if (value.length <= 8) {
            return value.replace(/(\d{2})(\d{3})(\d{1,3})/, '$1.$2.$3');
        } else {
            return value.replace(/(\d{2})(\d{3})(\d{3})(\d{1})/, '$1.$2.$3-$4');
        }
    }
}

// Aplicar máscara no campo de documento
document.getElementById('numeroDocumento').addEventListener('input', function(e) {
    const tipo = document.getElementById('tipoDocumento').value;
    let value = e.target.value;
    
    if (tipo === 'CPF') {
        e.target.value = formatCPF(value);
    } else if (tipo === 'RG') {
        e.target.value = formatRG(value);
    }
});

// Limpar e reaplicar máscara quando mudar o tipo de documento
document.getElementById('tipoDocumento').addEventListener('change', function(e) {
    const numeroDocumento = document.getElementById('numeroDocumento');
    const value = numeroDocumento.value.replace(/\D/g, '');
    
    if (e.target.value === 'CPF') {
        numeroDocumento.value = formatCPF(value);
        numeroDocumento.placeholder = '000.000.000-00';
        numeroDocumento.maxLength = 14;
    } else if (e.target.value === 'RG') {
        numeroDocumento.value = formatRG(value);
        numeroDocumento.placeholder = '0.000.000 ou 00.000.000-0';
        numeroDocumento.maxLength = 12;
    } else {
        numeroDocumento.value = value;
        numeroDocumento.placeholder = '';
        numeroDocumento.removeAttribute('maxLength');
    }
});

// Navigation tab events
tabDashboard.addEventListener('click', () => {
    ipcRenderer.send('load-dashboard');
});

// Função para formatar valor monetário: R$ 1.500,00
function formatMoney(value) {
    // Remove tudo que não é dígito
    value = value.replace(/\D/g, '');
    
    // Converte para centavos
    value = (parseInt(value) / 100).toFixed(2);
    
    // Formata com separadores
    value = value.replace('.', ',');
    value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    
    return value;
}

// Aplicar máscara no campo de valor
document.getElementById('valorItem').addEventListener('input', function(e) {
    let value = e.target.value;
    e.target.value = formatMoney(value);
});

// Adicionar placeholder com exemplo no campo de valor
document.getElementById('valorItem').addEventListener('focus', function(e) {
    if (!e.target.value) {
        e.target.placeholder = 'Ex: 1.500,00';
    }
});

// Controlar visibilidade do campo de peso baseado na unidade de medida
document.getElementById('unidadeMedida').addEventListener('change', function(e) {
    const pesoGroup = document.getElementById('pesoGroup');
    const pesoInput = document.getElementById('peso');
    const unidadesSelecionadas = ['mg', 'g', 'kg', 't'];
    
    if (unidadesSelecionadas.includes(e.target.value)) {
        // Mostrar campo de peso com animação
        pesoGroup.style.display = 'block';
        pesoGroup.classList.add('show');
        pesoInput.required = true;
        
        // Atualizar placeholder e texto de ajuda baseado na unidade
        const unidadeTexto = {
            'mg': 'Ex: 500',
            'g': 'Ex: 10', 
            'kg': 'Ex: 2.5',
            't': 'Ex: 1.2'
        };
        
        const unidadeNome = {
            'mg': 'miligramas',
            'g': 'gramas',
            'kg': 'quilogramas', 
            't': 'toneladas'
        };
        
        pesoInput.placeholder = unidadeTexto[e.target.value] || 'Digite o peso';
        
        // Atualizar texto de ajuda
        const helpText = pesoGroup.querySelector('.field-help');
        if (helpText) {
            helpText.textContent = `Digite o peso em ${unidadeNome[e.target.value]}`;
        }
        
        // Focar no campo de peso
        setTimeout(() => {
            pesoInput.focus();
        }, 300);
    } else {
        // Esconder campo de peso com animação
        pesoGroup.classList.remove('show');
        setTimeout(() => {
            pesoGroup.style.display = 'none';
        }, 300);
        pesoInput.required = false;
        pesoInput.value = '';
    }
});

// Validação do campo de peso (apenas números e vírgula/ponto decimal)
document.getElementById('peso').addEventListener('input', function(e) {
    let value = e.target.value;
    
    // Permitir apenas números, vírgula e ponto
    value = value.replace(/[^0-9.,]/g, '');
    
    // Substituir vírgula por ponto para padronização
    value = value.replace(',', '.');
    
    // Permitir apenas um ponto decimal
    const parts = value.split('.');
    if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
    }
    
    e.target.value = value;
});