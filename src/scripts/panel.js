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
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const loadingSubtext = document.getElementById('loadingSubtext');

// Navigation tabs
const tabDashboard = document.getElementById('tabDashboard');
const tabNovaOcorrencia = document.getElementById('tabNovaOcorrencia');

// Carregar informações do usuário
window.addEventListener('load', () => {
    const username = sessionStorage.getItem('username');
    if (username) {
        userInfo.textContent = `${username}`;
    }
    
    // Inicializar calendários Flatpickr após um pequeno delay
    setTimeout(() => {
        console.log('Iniciando calendários...');
        initializeDatePickers();
    }, 500);
    
    // Definir data atual no campo de data de apreensão se estiver vazio
    const dataApreensaoField = document.getElementById('dataApreensao');
    if (dataApreensaoField && !dataApreensaoField.value) {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        dataApreensaoField.value = `${day}/${month}/${year}`;
    }
});

// Submit do formulário
occurrenceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validar datas antes de enviar
    const dataApreensao = document.getElementById('dataApreensao').value;
    const dataNascimento = document.getElementById('dataNascimento').value;
    const numeroGenesis = document.getElementById('numeroGenesis').value;
    
    if (!isValidDate(dataApreensao)) {
        showError('Data de apreensão inválida. Use o formato dd/mm/aaaa');
        return;
    }
    
    if (!isValidDate(dataNascimento)) {
        showError('Data de nascimento inválida. Use o formato dd/mm/aaaa');
        return;
    }
    
    // Validar formato do número Genesis (deve ter 6 números + hífen + 4 dígitos do ano)
    const genesisPattern = /^\d{6}-\d{4}$/;
    if (!genesisPattern.test(numeroGenesis)) {
        showError('Número Genesis inválido. Deve conter 6 números seguidos de hífen e ano (ex: 123456-2025)');
        return;
    }
    
    // Coletar dados do formulário
    const formData = {
        ocorrencia: {
            numeroGenesis: document.getElementById('numeroGenesis').value,
            unidade: document.getElementById('unidade').value,
            dataApreensao: brDateToISO(dataApreensao),
            leiInfrigida: document.getElementById('leiInfrigida').value,
            artigo: document.getElementById('artigo').value
        },
        itemApreendido: {
            especie: document.getElementById('especie').value,
            item: document.getElementById('item').value,
            quantidade: document.getElementById('quantidade').value,
            unidadeMedida: document.getElementById('unidadeMedida').value,
            descricao: document.getElementById('descricaoItem').value
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
    
    // Mostrar loading global
    showLoading('Salvando ocorrência', 'Enviando dados para o sistema...');
    hideMessages();
    
    try {
        const result = await ipcRenderer.invoke('save-occurrence', formData);
        
        if (result.success) {
            hideLoading();
            showSuccess(result.message);
            // Limpar formulário após sucesso
            setTimeout(() => {
                clearForm();
            }, 2000);
        } else {
            hideLoading();
            showError(result.message || 'Erro ao salvar ocorrência');
        }
    } catch (error) {
        console.error('Erro ao salvar:', error);
        hideLoading();
        showError('Erro ao salvar ocorrência: ' + error.message);
    }
});

// Limpar formulário
clearBtn.addEventListener('click', () => {
    customAlert.confirm(
        'Deseja realmente limpar todos os campos do formulário?',
        () => {
            clearForm();
        },
        null,
        'Limpar Formulário'
    );
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
    customAlert.confirm(
        'Deseja realmente sair do sistema?',
        () => {
            sessionStorage.clear();
            ipcRenderer.send('logout');
        }
    );
});

// Funções auxiliares
function showLoading(text = 'Processando', subtext = 'Aguarde um momento') {
    loadingText.textContent = text;
    loadingSubtext.textContent = subtext;
    loadingOverlay.classList.add('active');
    submitBtn.disabled = true;
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
    submitBtn.disabled = false;
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
    hideLoading();
    
    // Reinicializar calendários com data atual
    initializeDatePickers();
    
    // Focar no primeiro campo
    document.getElementById('numeroGenesis').focus();
}

// Máscara avançada para data no formato brasileiro (dd/mm/aaaa)
function applyDateMask(e) {
    let value = e.target.value;
    
    // Permitir apenas números e barras
    value = value.replace(/[^\d\/]/g, '');
    
    // Remover barras extras
    value = value.replace(/\/+/g, '/');
    
    // Aplicar formatação automática
    let numbers = value.replace(/\D/g, '');
    
    if (numbers.length >= 2) {
        let day = numbers.substring(0, 2);
        let month = numbers.substring(2, 4);
        let year = numbers.substring(4, 8);
        
        // Validar dia (01-31)
        if (parseInt(day) > 31) {
            day = '31';
        }
        if (parseInt(day) < 1 && day.length === 2) {
            day = '01';
        }
        
        // Validar mês (01-12)
        if (month.length > 0) {
            if (parseInt(month) > 12) {
                month = '12';
            }
            if (parseInt(month) < 1 && month.length === 2) {
                month = '01';
            }
        }
        
        // Montar a data formatada
        value = day;
        if (month.length > 0) {
            value += '/' + month;
        }
        if (year.length > 0) {
            value += '/' + year;
        }
    } else {
        value = numbers;
    }
    
    // Limitar o comprimento total
    if (value.length > 10) {
        value = value.substring(0, 10);
    }
    
    e.target.value = value;
}

// Função para filtrar entrada de teclas em campos de data
function filterDateInput(e) {
    const key = e.key;
    const value = e.target.value;
    
    // Permitir teclas de controle
    if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
        return true;
    }
    
    // Permitir Ctrl+A, Ctrl+C, Ctrl+V, etc.
    if (e.ctrlKey || e.metaKey) {
        return true;
    }
    
    // Permitir apenas números e barra
    if (!/[\d\/]/.test(key)) {
        e.preventDefault();
        return false;
    }
    
    // Não permitir mais de 2 barras
    if (key === '/' && (value.match(/\//g) || []).length >= 2) {
        e.preventDefault();
        return false;
    }
    
    // Não permitir mais de 10 caracteres
    if (value.length >= 10 && !['Backspace', 'Delete'].includes(key)) {
        e.preventDefault();
        return false;
    }
    
    return true;
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
    
    // Validar dias por mês
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    
    // Verificar ano bissexto
    if (month === 2 && isLeapYear(year)) {
        daysInMonth[1] = 29;
    }
    
    if (day > daysInMonth[month - 1]) return false;
    
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && 
           date.getMonth() === month - 1 && 
           date.getDate() === day;
}

// Verificar se é ano bissexto
function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

// Validar data parcial durante a digitação
function validatePartialDate(value) {
    const parts = value.split('/');
    
    if (parts.length >= 1) {
        const day = parseInt(parts[0]);
        if (parts[0].length === 2 && (day < 1 || day > 31)) {
            return false;
        }
    }
    
    if (parts.length >= 2) {
        const month = parseInt(parts[1]);
        if (parts[1].length === 2 && (month < 1 || month > 12)) {
            return false;
        }
    }
    
    if (parts.length === 3 && parts[2].length === 4) {
        return isValidDate(value);
    }
    
    return true;
}

// Converter data brasileira para ISO (yyyy-mm-dd)
function brDateToISO(brDate) {
    const [day, month, year] = brDate.split('/');
    return `${year}-${month}-${day}`;
}

// Inicializar calendários Flatpickr
function initializeDatePickers() {
    // Usar Flatpickr global (carregado via script tag)
    if (typeof flatpickr !== 'undefined') {
        console.log('Flatpickr disponível globalmente');
    
    // Configurar calendário para data de apreensão
    const dataApreensaoField = document.getElementById('dataApreensao');
    if (dataApreensaoField) {
        const fpInstance = window.flatpickr(dataApreensaoField, {
            locale: window.flatpickr.l10ns.pt || 'default',
            dateFormat: 'd/m/Y',
            defaultDate: new Date(),
            allowInput: true,
            clickOpens: true,
            disableMobile: false,
            onChange: function(selectedDates, dateStr, instance) {
                console.log('Data de apreensão selecionada:', dateStr);
                // Atualizar o número Genesis quando a data mudar
                updateGenesisWithYear();
            },
            onClose: function(selectedDates, dateStr, instance) {
                // Validar a data quando o calendário fechar
                if (dateStr && !isValidDate(dateStr)) {
                    showError('Data inválida. Use o formato dd/mm/aaaa');
                    instance.clear();
                }
            }
        });
        
        // Adicionar filtros para entrada manual
        dataApreensaoField.addEventListener('keydown', filterDateInput);
        dataApreensaoField.addEventListener('input', function(e) {
            // Só aplicar máscara se não for um evento do Flatpickr
            if (!fpInstance.isOpen) {
                applyDateMask(e);
                
                // Validar data parcial e dar feedback visual
                const value = e.target.value;
                if (value.length >= 8) {
                    if (validatePartialDate(value)) {
                        e.target.style.borderColor = '';
                        e.target.style.backgroundColor = '';
                    } else {
                        e.target.style.borderColor = '#f44336';
                        e.target.style.backgroundColor = '#ffebee';
                    }
                }
                
                updateGenesisWithYear();
            }
        });
    }
    
    // Configurar calendário para data de nascimento
    const dataNascimentoField = document.getElementById('dataNascimento');
    console.log('Campo dataNascimento encontrado:', !!dataNascimentoField);
    if (dataNascimentoField) {
        const fpInstanceNasc = window.flatpickr(dataNascimentoField, {
            locale: window.flatpickr.l10ns.pt || 'default',
            dateFormat: 'd/m/Y',
            allowInput: true,
            clickOpens: true,
            maxDate: new Date(),
            disableMobile: false,
            onChange: function(selectedDates, dateStr, instance) {
                console.log('Data de nascimento selecionada:', dateStr);
                // Remover estilos de erro se houver
                instance.input.style.borderColor = '';
                instance.input.style.backgroundColor = '';
            },
            onOpen: function(selectedDates, dateStr, instance) {
                console.log('Calendário de nascimento aberto');
            },
            onClose: function(selectedDates, dateStr, instance) {
                console.log('Calendário de nascimento fechado');
                if (dateStr && !isValidDate(dateStr)) {
                    showError('Data de nascimento inválida. Use o formato dd/mm/aaaa');
                    instance.clear();
                }
            }
        });
        
        // Configurar eventos após a inicialização do Flatpickr
        setTimeout(() => {
            // Event listener para digitação manual
            dataNascimentoField.addEventListener('keydown', function(e) {
                if (!fpInstanceNasc.isOpen) {
                    filterDateInputSimple(e);
                }
            });
            
            dataNascimentoField.addEventListener('input', function(e) {
                if (!fpInstanceNasc.isOpen) {
                    applySimpleDateMask(e);
                }
            });
        }, 100);
        
        // Validar quando sair do campo
        dataNascimentoField.addEventListener('blur', function(e) {
            const value = e.target.value;
            if (value.length === 10) {
                if (isValidDate(value)) {
                    e.target.style.borderColor = '';
                    e.target.style.backgroundColor = '';
                } else {
                    e.target.style.borderColor = '#f44336';
                    e.target.style.backgroundColor = '#ffebee';
                    showError('Data de nascimento inválida. Verifique o formato dd/mm/aaaa');
                }
            }
        });
    }
    } else {
        console.log('Flatpickr não disponível, usando apenas máscaras');
        // Fallback: manter funcionalidade de máscara manual
        document.getElementById('dataApreensao').addEventListener('input', applyDateMask);
        document.getElementById('dataNascimento').addEventListener('input', applySimpleDateMask);
    }
}

// Função alternativa para usar Flatpickr global
function initializeFlatpickrGlobal() {
    const flatpickr = window.flatpickr;
    
    // Data de apreensão
    const dataApreensaoField = document.getElementById('dataApreensao');
    if (dataApreensaoField) {
        flatpickr(dataApreensaoField, {
            dateFormat: 'd/m/Y',
            defaultDate: new Date(),
            allowInput: true,
            clickOpens: true
        });
    }
    
    // Data de nascimento
    const dataNascimentoField = document.getElementById('dataNascimento');
    if (dataNascimentoField) {
        flatpickr(dataNascimentoField, {
            dateFormat: 'd/m/Y',
            allowInput: true,
            clickOpens: true,
            maxDate: new Date()
        });
        
        // Adicionar máscara para digitação manual
        dataNascimentoField.addEventListener('input', applySimpleDateMask);
    }
}

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

// Função para formatar automaticamente o Nº Genesis
function formatGenesisNumber(input) {
    let value = input.replace(/\D/g, ''); // Remove tudo que não é número
    
    // Se tem mais de 6 dígitos, mantém apenas os primeiros 6
    if (value.length > 6) {
        value = value.substring(0, 6);
    }
    
    return value;
}

// Função para atualizar o Nº Genesis com o ano automaticamente
function updateGenesisWithYear() {
    const dataApreensao = document.getElementById('dataApreensao').value;
    const numeroGenesis = document.getElementById('numeroGenesis');
    let currentValue = numeroGenesis.value;
    
    // Extrair apenas os números do campo Genesis
    let genesisNumbers = formatGenesisNumber(currentValue);
    
    // Determinar o ano a ser usado
    let yearToUse = new Date().getFullYear(); // Ano atual por padrão
    
    // Se a data de apreensão está preenchida e válida, usar o ano dela
    if (dataApreensao.length === 10 && isValidDate(dataApreensao)) {
        yearToUse = parseInt(dataApreensao.split('/')[2]);
    }
    
    // Se tem 6 dígitos, adicionar o hífen e o ano
    if (genesisNumbers.length === 6) {
        const newValue = genesisNumbers + '-' + yearToUse;
        if (numeroGenesis.value !== newValue) {
            numeroGenesis.value = newValue;
            
            // Adicionar feedback visual temporário
            numeroGenesis.style.backgroundColor = '#e8f5e9';
            numeroGenesis.style.borderColor = '#4caf50';
            setTimeout(() => {
                numeroGenesis.style.backgroundColor = '';
                numeroGenesis.style.borderColor = '';
            }, 1000);
        }
    } else if (genesisNumbers.length > 0 && genesisNumbers.length < 6) {
        // Se tem menos de 6 dígitos, mostrar apenas os números
        numeroGenesis.value = genesisNumbers;
    }
}

// Event listener removido - agora está integrado no Flatpickr

// Atualizar Nº Genesis quando o número for digitado
document.getElementById('numeroGenesis').addEventListener('input', function(e) {
    // Aplicar formatação em tempo real
    const cursorPosition = e.target.selectionStart;
    const oldValue = e.target.value;
    
    updateGenesisWithYear();
    
    // Manter o cursor na posição correta após a formatação
    const newValue = e.target.value;
    if (oldValue !== newValue) {
        // Se o valor mudou (foi formatado), ajustar a posição do cursor
        let newCursorPosition = cursorPosition;
        if (newValue.includes('-') && !oldValue.includes('-')) {
            // Se o hífen foi adicionado, não mover o cursor
            if (cursorPosition > 6) {
                newCursorPosition = newValue.length;
            }
        }
        setTimeout(() => {
            e.target.setSelectionRange(newCursorPosition, newCursorPosition);
        }, 0);
    }
});

// Adicionar placeholder e dica visual nos campos
document.addEventListener('DOMContentLoaded', function() {
    const genesisField = document.getElementById('numeroGenesis');
    if (genesisField) {
        genesisField.placeholder = 'Digite os 6 números (ex: 123456)';
        genesisField.title = 'Digite apenas os 6 números do GENESIS. O ano será adicionado automaticamente.';
        
        // Limitar a 11 caracteres (6 números + hífen + 4 dígitos do ano)
        genesisField.maxLength = 11;
        
        // Tratar evento de colar (paste)
        genesisField.addEventListener('paste', function(e) {
            e.preventDefault();
            
            // Obter o texto colado
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            
            // Extrair apenas números
            const numbersOnly = pastedText.replace(/\D/g, '');
            
            // Se tem exatamente 6 números, usar a função de formatação
            if (numbersOnly.length >= 6) {
                const genesisNumbers = numbersOnly.substring(0, 6);
                this.value = genesisNumbers;
                updateGenesisWithYear();
            } else {
                // Se tem menos de 6 números, apenas inserir os números
                this.value = numbersOnly;
            }
        });
    }
    
    // Configurar campo de data de nascimento
    const dataNascField = document.getElementById('dataNascimento');
    if (dataNascField) {
        dataNascField.placeholder = 'dd/mm/aaaa ou clique para calendário';
        dataNascField.title = 'Digite diretamente (barras automáticas) ou clique no ícone para abrir o calendário';
        dataNascField.maxLength = 10;
    }
});

// Máscara simples para data de nascimento - adiciona barras automaticamente
function applySimpleDateMask(e) {
    let value = e.target.value.replace(/\D/g, ''); // Remove tudo que não é número
    
    // Limitar a 8 dígitos
    if (value.length > 8) {
        value = value.substring(0, 8);
    }
    
    // Adicionar barras automaticamente
    if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2);
    }
    if (value.length >= 5) {
        value = value.substring(0, 5) + '/' + value.substring(5);
    }
    
    e.target.value = value;
}

// Filtro simples de teclas para data de nascimento
function filterDateInputSimple(e) {
    const key = e.key;
    
    // Permitir teclas de controle
    if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
        return true;
    }
    
    // Permitir Ctrl+A, Ctrl+C, Ctrl+V, etc.
    if (e.ctrlKey || e.metaKey) {
        return true;
    }
    
    // Permitir apenas números
    if (!/\d/.test(key)) {
        e.preventDefault();
        return false;
    }
    
    // Não permitir mais de 10 caracteres (incluindo as barras)
    if (e.target.value.length >= 10) {
        e.preventDefault();
        return false;
    }
    
    return true;
}

// Event listeners para data de nascimento foram movidos para dentro da configuração do Flatpickr

// Navigation tab events
tabDashboard.addEventListener('click', () => {
    ipcRenderer.send('load-dashboard');
});

// ==================== FUNCIONALIDADE DE PREENCHIMENTO POR ARQUIVO ====================

// Elementos da interface
const modeSelectionScreen = document.getElementById('modeSelectionScreen');
const selectManualMode = document.getElementById('selectManualMode');
const selectFileMode = document.getElementById('selectFileMode');
const fileUploadSection = document.getElementById('fileUploadSection');
const formWrapper = document.getElementById('formWrapper');
const backFromFileBtn = document.getElementById('backFromFileBtn');
const backFromFormBtn = document.getElementById('backFromFormBtn');

// Elementos de upload
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const selectFileBtn = document.getElementById('selectFileBtn');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const removeFileBtn = document.getElementById('removeFileBtn');
const extractBtn = document.getElementById('extractBtn');

let selectedFile = null;

// Navegar para modo manual - vai direto para o formulário
selectManualMode.addEventListener('click', () => {
    modeSelectionScreen.style.display = 'none';
    formWrapper.style.display = 'block';
});

// Modo arquivo - abre o seletor de arquivo imediatamente
selectFileMode.addEventListener('click', () => {
    fileInput.click();
});

// Voltar da tela de upload para seleção
backFromFileBtn.addEventListener('click', () => {
    fileUploadSection.style.display = 'none';
    modeSelectionScreen.style.display = 'flex';
    // Limpar arquivo selecionado
    if (selectedFile) {
        removeFileBtn.click();
    }
});

// Voltar da tela de formulário para seleção
backFromFormBtn.addEventListener('click', () => {
    formWrapper.style.display = 'none';
    modeSelectionScreen.style.display = 'flex';
});

// Abrir seletor de arquivo
selectFileBtn.addEventListener('click', () => {
    fileInput.click();
});

uploadArea.addEventListener('click', (e) => {
    if (e.target === uploadArea || e.target.closest('.upload-area')) {
        fileInput.click();
    }
});

// Processar arquivo selecionado
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        // Esconder tela de seleção e mostrar tela de upload
        modeSelectionScreen.style.display = 'none';
        fileUploadSection.style.display = 'block';
        handleFileSelect(file);
    }
});

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    
    const file = e.dataTransfer.files[0];
    if (file) {
        handleFileSelect(file);
    }
});

// Função para processar arquivo selecionado
function handleFileSelect(file) {
    const validExtensions = ['.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
        showError('Tipo de arquivo não suportado. Use PDF, Word, Imagem ou TXT.');
        return;
    }
    
    selectedFile = file;
    
    // Mostrar informações do arquivo
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    
    uploadArea.style.display = 'none';
    fileInfo.style.display = 'block';
}

// Remover arquivo selecionado
removeFileBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    uploadArea.style.display = 'block';
    fileInfo.style.display = 'none';
});

// Extrair dados do arquivo
extractBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        showError('Nenhum arquivo selecionado');
        return;
    }
    
    showLoading('Extraindo dados', 'Processando arquivo... Isso pode levar alguns instantes.');
    hideMessages();
    
    try {
        // Enviar arquivo para o processo principal para extração
        const result = await ipcRenderer.invoke('extract-file-data', selectedFile.path);
        
        hideLoading();
        
        if (result.success) {
            // Preencher formulário com os dados extraídos
            fillFormWithExtractedData(result.data);
            showSuccess('Dados extraídos com sucesso!');
            
            // Ir para o formulário após extração
            setTimeout(() => {
                fileUploadSection.style.display = 'none';
                formWrapper.style.display = 'block';
            }, 2000);
        } else {
            showError(result.message || 'Erro ao extrair dados do arquivo');
        }
    } catch (error) {
        console.error('Erro ao extrair dados:', error);
        hideLoading();
        showError('Erro ao processar arquivo: ' + error.message);
    }
});

// Função para preencher o formulário com dados extraídos
function fillFormWithExtractedData(data) {
    // Preencher campos se os dados existirem
    if (data.numeroGenesis) {
        document.getElementById('numeroGenesis').value = data.numeroGenesis;
    }
    
    if (data.dataApreensao) {
        document.getElementById('dataApreensao').value = data.dataApreensao;
    }
    
    if (data.artigo) {
        document.getElementById('artigo').value = data.artigo;
    }
    
    if (data.quantidade) {
        document.getElementById('quantidade').value = data.quantidade;
    }
    
    // Dados do proprietário
    if (data.nomeProprietario) {
        document.getElementById('nomeProprietario').value = data.nomeProprietario;
    }
    
    if (data.dataNascimento) {
        document.getElementById('dataNascimento').value = data.dataNascimento;
    }
    
    if (data.tipoDocumento) {
        document.getElementById('tipoDocumento').value = data.tipoDocumento;
        // Trigger change event para aplicar máscara
        document.getElementById('tipoDocumento').dispatchEvent(new Event('change'));
    }
    
    if (data.numeroDocumento) {
        document.getElementById('numeroDocumento').value = data.numeroDocumento;
    }
    
    if (data.matricula) {
        document.getElementById('matricula').value = data.matricula;
    }
    
    // Adicionar classe de destaque aos campos preenchidos
    highlightFilledFields();
}

// Destacar campos preenchidos automaticamente
function highlightFilledFields() {
    const inputs = document.querySelectorAll('#occurrenceForm input, #occurrenceForm select, #occurrenceForm textarea');
    inputs.forEach(input => {
        if (input.value && input.value.trim() !== '') {
            input.style.backgroundColor = '#e8f5e9';
            input.style.borderColor = '#4caf50';
            
            // Remover destaque após 3 segundos
            setTimeout(() => {
                input.style.backgroundColor = '';
                input.style.borderColor = '';
            }, 3000);
        }
    });
}

// Função auxiliar para formatar tamanho do arquivo
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

