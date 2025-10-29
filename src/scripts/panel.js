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
            descricao: document.getElementById('descricaoItem').value,
            ocorrencia: document.getElementById('ocorrenciaItem').value,
            proprietario: document.getElementById('proprietarioItem').value,
            policial: document.getElementById('policialItem').value
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

// Melhorar experiência de digitação - permitir navegação rápida
document.getElementById('dataApreensao').addEventListener('keydown', handleDateKeydown);
document.getElementById('dataNascimento').addEventListener('keydown', handleDateKeydown);

// Função para melhorar navegação por teclado nos campos de data
function handleDateKeydown(e) {
    const input = e.target;
    
    // Permitir teclas de navegação e edição
    const allowedKeys = [
        'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Home', 'End'
    ];
    
    if (allowedKeys.includes(e.key)) {
        return;
    }
    
    // Permitir Ctrl+A, Ctrl+C, Ctrl+V, etc.
    if (e.ctrlKey || e.metaKey) {
        return;
    }
    
    // Permitir apenas números
    if (!/^\d$/.test(e.key)) {
        e.preventDefault();
        return;
    }
    
    // Auto-avançar para próximo campo quando completar a data
    setTimeout(() => {
        if (input.value.length === 10 && isValidDate(input.value)) {
            // Mover para próximo campo
            const form = input.closest('form');
            const inputs = Array.from(form.querySelectorAll('input, select, textarea'));
            const currentIndex = inputs.indexOf(input);
            if (currentIndex < inputs.length - 1) {
                inputs[currentIndex + 1].focus();
            }
        }
    }, 10);
}

// Validação ao sair do campo de data
document.getElementById('dataApreensao').addEventListener('blur', function(e) {
    if (e.target.value && !isValidDate(e.target.value)) {
        showError('Data de apreensão inválida. Use o formato dd/mm/aaaa');
        e.target.classList.remove('date-valid');
        e.target.focus();
    } else {
        hideMessages();
        if (e.target.value && isValidDate(e.target.value)) {
            e.target.classList.add('date-valid');
            setTimeout(() => e.target.classList.remove('date-valid'), 300);
        }
    }
});

// Feedback visual em tempo real para data de apreensão
document.getElementById('dataApreensao').addEventListener('input', function(e) {
    if (e.target.value.length === 10 && isValidDate(e.target.value)) {
        e.target.classList.add('date-valid');
        setTimeout(() => e.target.classList.remove('date-valid'), 300);
    }
});

document.getElementById('dataNascimento').addEventListener('blur', function(e) {
    if (e.target.value && !isValidDate(e.target.value)) {
        showError('Data de nascimento inválida. Use o formato dd/mm/aaaa');
        e.target.classList.remove('date-valid');
        e.target.focus();
    } else {
        hideMessages();
        if (e.target.value && isValidDate(e.target.value)) {
            e.target.classList.add('date-valid');
            setTimeout(() => e.target.classList.remove('date-valid'), 300);
        }
    }
});

// Feedback visual em tempo real para data de nascimento
document.getElementById('dataNascimento').addEventListener('input', function(e) {
    if (e.target.value.length === 10 && isValidDate(e.target.value)) {
        e.target.classList.add('date-valid');
        setTimeout(() => e.target.classList.remove('date-valid'), 300);
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

// ===== CALENDÁRIO POPUP =====

class CalendarPopup {
    constructor() {
        this.currentDate = new Date();
        this.selectedDate = null;
        this.targetInput = null;
        
        // Elementos do DOM
        this.overlay = document.getElementById('calendarOverlay');
        this.title = document.getElementById('calendarTitle');
        this.daysContainer = document.getElementById('calendarDays');
        this.prevBtn = document.getElementById('prevMonth');
        this.nextBtn = document.getElementById('nextMonth');
        this.cancelBtn = document.getElementById('calendarCancel');
        this.todayBtn = document.getElementById('calendarToday');
        
        // Nomes dos meses
        this.months = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        
        this.init();
    }
    
    init() {
        // Event listeners
        this.prevBtn.addEventListener('click', () => this.previousMonth());
        this.nextBtn.addEventListener('click', () => this.nextMonth());
        this.cancelBtn.addEventListener('click', () => this.close());
        this.todayBtn.addEventListener('click', () => this.selectToday());
        
        // Fechar ao clicar fora do calendário
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });
        
        // Fechar com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
                this.close();
            }
        });
    }
    
    show(inputElement) {
        this.targetInput = inputElement;
        
        // Se o input já tem uma data válida, usar como data inicial
        const inputValue = inputElement.value;
        if (inputValue && this.isValidBRDate(inputValue)) {
            const [day, month, year] = inputValue.split('/');
            this.currentDate = new Date(year, month - 1, day);
            this.selectedDate = new Date(this.currentDate);
        } else {
            // Usar data atual como padrão
            this.currentDate = new Date();
            this.selectedDate = null;
        }
        
        this.render();
        this.overlay.classList.add('active');
        
        // Focar no calendário para navegação por teclado
        setTimeout(() => {
            this.overlay.focus();
        }, 100);
    }
    
    // Método para sincronizar calendário com input digitado
    syncWithInput(inputElement) {
        const inputValue = inputElement.value;
        if (inputValue && this.isValidBRDate(inputValue)) {
            const [day, month, year] = inputValue.split('/');
            this.currentDate = new Date(year, month - 1, day);
            this.selectedDate = new Date(this.currentDate);
            
            // Se o calendário estiver aberto, atualizar
            if (this.overlay.classList.contains('active') && this.targetInput === inputElement) {
                this.render();
            }
        }
    }
    
    close() {
        this.overlay.classList.remove('active');
        this.targetInput = null;
        this.selectedDate = null;
        
        // Retornar foco para o input
        if (this.targetInput) {
            this.targetInput.focus();
        }
    }
    
    previousMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.render();
    }
    
    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.render();
    }
    
    selectToday() {
        const today = new Date();
        this.selectDate(today);
    }
    
    selectDate(date) {
        this.selectedDate = new Date(date);
        
        // Formatar data no padrão brasileiro (dd/mm/yyyy)
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        if (this.targetInput) {
            this.targetInput.value = `${day}/${month}/${year}`;
            
            // Disparar eventos para validação
            const inputEvent = new Event('input', { bubbles: true });
            const changeEvent = new Event('change', { bubbles: true });
            this.targetInput.dispatchEvent(inputEvent);
            this.targetInput.dispatchEvent(changeEvent);
        }
        
        this.close();
    }
    
    render() {
        // Atualizar título
        this.title.textContent = `${this.months[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
        
        // Limpar dias anteriores
        this.daysContainer.innerHTML = '';
        
        // Calcular primeiro e último dia do mês
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        
        // Calcular data de início (incluindo dias do mês anterior)
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        
        // Gerar 42 dias (6 semanas completas)
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const dayBtn = document.createElement('button');
            dayBtn.className = 'calendar-day';
            dayBtn.textContent = date.getDate();
            dayBtn.type = 'button';
            
            // Verificar se é do mês atual
            if (date.getMonth() !== this.currentDate.getMonth()) {
                dayBtn.classList.add('other-month');
            }
            
            // Verificar se é hoje
            const today = new Date();
            if (this.isSameDay(date, today)) {
                dayBtn.classList.add('today');
            }
            
            // Verificar se está selecionado
            if (this.selectedDate && this.isSameDay(date, this.selectedDate)) {
                dayBtn.classList.add('selected');
            }
            
            // Event listener para seleção
            dayBtn.addEventListener('click', () => this.selectDate(date));
            
            this.daysContainer.appendChild(dayBtn);
        }
    }
    
    isSameDay(date1, date2) {
        return date1.getDate() === date2.getDate() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getFullYear() === date2.getFullYear();
    }
    
    isValidBRDate(dateString) {
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
}

// Inicializar calendário
const calendarPopup = new CalendarPopup();

// Event listeners para os botões de calendário
document.addEventListener('DOMContentLoaded', function() {
    const calendarBtnApreensao = document.getElementById('calendarBtnApreensao');
    const calendarBtnNascimento = document.getElementById('calendarBtnNascimento');
    const dataApreensao = document.getElementById('dataApreensao');
    const dataNascimento = document.getElementById('dataNascimento');
    
    // Botões de calendário
    if (calendarBtnApreensao) {
        calendarBtnApreensao.addEventListener('click', (e) => {
            e.preventDefault();
            calendarPopup.show(dataApreensao);
        });
    }
    
    if (calendarBtnNascimento) {
        calendarBtnNascimento.addEventListener('click', (e) => {
            e.preventDefault();
            calendarPopup.show(dataNascimento);
        });
    }
    
    // Duplo clique nos campos de data para abrir calendário
    if (dataApreensao) {
        dataApreensao.addEventListener('dblclick', () => {
            calendarPopup.show(dataApreensao);
        });
        
        // Sincronizar calendário quando usuário digita
        dataApreensao.addEventListener('input', () => {
            calendarPopup.syncWithInput(dataApreensao);
        });
        
        // Tooltip simples
        dataApreensao.title = 'Data da apreensão (dd/mm/aaaa)';
    }
    
    if (dataNascimento) {
        dataNascimento.addEventListener('dblclick', () => {
            calendarPopup.show(dataNascimento);
        });
        
        // Sincronizar calendário quando usuário digita
        dataNascimento.addEventListener('input', () => {
            calendarPopup.syncWithInput(dataNascimento);
        });
        
        // Tooltip simples
        dataNascimento.title = 'Data de nascimento (dd/mm/aaaa)';
    }
});