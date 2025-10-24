const { ipcRenderer } = require('electron');
const Chart = require('chart.js/auto');

// Elements
const userInfo = document.getElementById('userInfo');
const userMenuBtn = document.getElementById('userMenuBtn');
const userDropdown = document.getElementById('userDropdown');
const logoutBtn = document.getElementById('logoutBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const loadingSubtext = document.getElementById('loadingSubtext');

// Tabs
const tabDashboard = document.getElementById('tabDashboard');
const tabOcorrencias = document.getElementById('tabOcorrencias');
const tabNovaOcorrencia = document.getElementById('tabNovaOcorrencia');

// Sections
const sectionDashboard = document.getElementById('sectionDashboard');
const sectionOcorrencias = document.getElementById('sectionOcorrencias');

// Stats
const statTotal = document.getElementById('statTotal');
const statMes = document.getElementById('statMes');
const statHoje = document.getElementById('statHoje');

// Table
const occurrencesTableBody = document.getElementById('occurrencesTableBody');
const searchInput = document.getElementById('searchInput');
const exportBtn = document.getElementById('exportBtn');
const refreshBtn = document.getElementById('refreshBtn');
const emptyState = document.getElementById('emptyState');
const btnNovaOcorrenciaEmpty = document.getElementById('btnNovaOcorrenciaEmpty');

// Modals
const viewModal = document.getElementById('viewModal');
const modalClose = document.getElementById('modalClose');
const modalBody = document.getElementById('modalBody');
const btnCancelEdit = document.getElementById('btnCancelEdit');
const btnDelete = document.getElementById('btnDelete');
const btnSaveEdit = document.getElementById('btnSaveEdit');

const deleteModal = document.getElementById('deleteModal');
const deleteModalClose = document.getElementById('deleteModalClose');
const deleteOccurrenceId = document.getElementById('deleteOccurrenceId');
const btnCancelDelete = document.getElementById('btnCancelDelete');
const btnConfirmDelete = document.getElementById('btnConfirmDelete');

const printModal = document.getElementById('printModal');
const printModalClose = document.getElementById('printModalClose');
const printOccurrenceId = document.getElementById('printOccurrenceId');
const btnCancelPrint = document.getElementById('btnCancelPrint');
const btnPrintTermoApreensao = document.getElementById('btnPrintTermoApreensao');

// State
let allOccurrences = [];
let filteredOccurrences = [];
let currentOccurrence = null;
let isEditMode = false;

// Charts
let lineChart = null;
let barChart = null;
let doughnutChart = null;

// Load user info
window.addEventListener('load', () => {
    const username = sessionStorage.getItem('username');
    if (username) {
        userInfo.textContent = username;
    }
    loadOccurrences();
});

// Funções de loading
function showLoading(text = 'Processando', subtext = 'Aguarde um momento') {
    loadingText.textContent = text;
    loadingSubtext.textContent = subtext;
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

// Load occurrences
async function loadOccurrences() {
    try {
        const result = await ipcRenderer.invoke('get-occurrences');
        if (result.success) {
            // Mapear dados do Google Sheets para a estrutura esperada
            allOccurrences = result.data.map(row => {
                // Se já está na estrutura correta, retorna como está
                if (row.ocorrencia && row.itemApreendido && row.proprietario && row.policial) {
                    return row;
                }
                
                // Caso contrário, mapeia da estrutura do Google Sheets
                return {
                    ocorrencia: {
                        numeroGenesis: row.numeroGenesis || '',
                        unidade: row.unidade || '',
                        dataApreensao: row.dataApreensao || '',
                        leiInfrigida: row.leiInfrigida || '',
                        artigo: row.artigo || '',
                        policialCondutor: row.policialCondutor || ''
                    },
                    itemApreendido: {
                        especie: row.especie || '',
                        item: row.item || '',
                        quantidade: row.quantidade || '',
                        unidadeMedida: row.unidadeMedida || '',
                        descricao: row.descricaoItem || '',
                        ocorrencia: row.ocorrenciaItem || '',
                        proprietario: row.proprietarioItem || '',
                        policial: row.policialItem || ''
                    },
                    proprietario: {
                        nome: row.nomeProprietario || '',
                        dataNascimento: row.dataNascimento || '',
                        tipoDocumento: row.tipoDocumento || '',
                        numeroDocumento: row.numeroDocumento || ''
                    },
                    policial: {
                        nome: row.nomePolicialCompleto || row.nomePolicial || '',
                        matricula: row.matricula || '',
                        graduacao: row.graduacao || '',
                        unidade: row.unidadePolicial || ''
                    },
                    metadata: {
                        registradoPor: row.registradoPor || '',
                        dataRegistro: row.logRegistro || new Date().toISOString()
                    }
                };
            });
            
            filteredOccurrences = [...allOccurrences];
            console.log('Ocorrências carregadas:', allOccurrences.length);
            updateStats();
            renderTable();
        } else {
            console.error('Erro ao carregar ocorrências:', result.message);
            showEmptyState();
        }
    } catch (error) {
        console.error('Erro ao carregar ocorrências:', error);
        showEmptyState();
    }
}

// Update statistics
function updateStats() {
    const total = allOccurrences.length;
    statTotal.textContent = total;

    // Count this month
    const now = new Date();
    const thisMonth = allOccurrences.filter(occ => {
        if (!occ.metadata?.dataRegistro) return false;
        const occDate = new Date(occ.metadata.dataRegistro);
        return occDate.getMonth() === now.getMonth() && 
               occDate.getFullYear() === now.getFullYear();
    }).length;
    statMes.textContent = thisMonth;

    // Count today
    const today = allOccurrences.filter(occ => {
        if (!occ.metadata?.dataRegistro) return false;
        const occDate = new Date(occ.metadata.dataRegistro);
        return occDate.toDateString() === now.toDateString();
    }).length;
    statHoje.textContent = today;
    
    // Update charts
    updateCharts();
}

// Render table
function renderTable() {
    if (filteredOccurrences.length === 0) {
        showEmptyState();
        return;
    }

    hideEmptyState();
    occurrencesTableBody.innerHTML = '';

    filteredOccurrences.forEach((occ, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${occ.ocorrencia?.numeroGenesis || 'N/A'}</strong></td>
            <td>${occ.ocorrencia?.dataApreensao ? formatDate(occ.ocorrencia.dataApreensao) : 'N/A'}</td>
            <td>${occ.ocorrencia?.unidade || 'N/A'}</td>
            <td>${occ.proprietario?.nome || 'N/A'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action btn-view" onclick="viewOccurrence(${index})" title="Ver detalhes">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                    <button class="btn-action btn-edit" onclick="editOccurrence(${index})" title="Editar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn-action btn-print" onclick="openPrintModal(${index})" title="Imprimir">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 6 2 18 2 18 9"/>
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                            <rect x="6" y="14" width="12" height="8"/>
                        </svg>
                    </button>
                    <button class="btn-action btn-delete-action" onclick="confirmDelete(${index})" title="Excluir">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </td>
        `;
        occurrencesTableBody.appendChild(row);
    });
}

// View occurrence
window.viewOccurrence = function(index) {
    currentOccurrence = filteredOccurrences[index];
    isEditMode = false;
    showModal(false);
};

// Edit occurrence
window.editOccurrence = function(index) {
    currentOccurrence = filteredOccurrences[index];
    isEditMode = true;
    showModal(true);
};

// Show modal
function showModal(editable) {
    if (!currentOccurrence) return;

    const modalTitle = document.getElementById('modalTitle');
    modalTitle.textContent = editable ? 'Editar Ocorrência' : 'Detalhes da Ocorrência';

    modalBody.innerHTML = `
        <div class="modal-form-section">
            <h3 class="modal-section-title">Dados da Ocorrência</h3>
            <div class="modal-form-grid">
                <div class="modal-form-group">
                    <label>Nº Genesis</label>
                    <input type="text" id="edit-numeroGenesis" value="${currentOccurrence.ocorrencia.numeroGenesis}" ${!editable ? 'disabled' : ''}>
                </div>
                <div class="modal-form-group">
                    <label>Unidade</label>
                    ${editable ? `
                    <select id="edit-unidade" ${!editable ? 'disabled' : ''}>
                        <option value="">Selecione...</option>
                        <option value="8º BPM" ${currentOccurrence.ocorrencia.unidade === '8º BPM' ? 'selected' : ''}>8º BPM</option>
                        <option value="10º BPM" ${currentOccurrence.ocorrencia.unidade === '10º BPM' ? 'selected' : ''}>10º BPM</option>
                        <option value="16º BPM" ${currentOccurrence.ocorrencia.unidade === '16º BPM' ? 'selected' : ''}>16º BPM</option>
                    </select>
                    ` : `
                    <input type="text" id="edit-unidade" value="${currentOccurrence.ocorrencia.unidade}" disabled>
                    `}
                </div>
                <div class="modal-form-group">
                    <label>Data da Apreensão</label>
                    <input type="text" id="edit-dataApreensao" value="${formatDateBR(currentOccurrence.ocorrencia.dataApreensao)}" ${!editable ? 'disabled' : ''}>
                </div>
                <div class="modal-form-group">
                    <label>Lei Infringida</label>
                    <input type="text" id="edit-leiInfrigida" value="${currentOccurrence.ocorrencia.leiInfrigida}" ${!editable ? 'disabled' : ''}>
                </div>
                <div class="modal-form-group">
                    <label>Artigo</label>
                    <input type="text" id="edit-artigo" value="${currentOccurrence.ocorrencia.artigo}" ${!editable ? 'disabled' : ''}>
                </div>
                <div class="modal-form-group">
                    <label>Policial Condutor</label>
                    <input type="text" id="edit-policialCondutor" value="${currentOccurrence.ocorrencia.policialCondutor}" ${!editable ? 'disabled' : ''}>
                </div>
            </div>
        </div>

        <div class="modal-form-section">
            <h3 class="modal-section-title">Item Apreendido</h3>
            <div class="modal-form-grid">
                <div class="modal-form-group">
                    <label>Espécie</label>
                    <input type="text" id="edit-especie" value="${currentOccurrence.itemApreendido.especie}" ${!editable ? 'disabled' : ''}>
                </div>
                <div class="modal-form-group">
                    <label>Item</label>
                    <input type="text" id="edit-item" value="${currentOccurrence.itemApreendido.item}" ${!editable ? 'disabled' : ''}>
                </div>
                <div class="modal-form-group">
                    <label>Quantidade</label>
                    <input type="text" id="edit-quantidade" value="${currentOccurrence.itemApreendido.quantidade} ${currentOccurrence.itemApreendido.unidadeMedida || ''}" ${!editable ? 'disabled' : ''}>
                </div>
                <div class="modal-form-group full-width">
                    <label>Descrição</label>
                    <textarea id="edit-descricao" rows="3" ${!editable ? 'disabled' : ''}>${currentOccurrence.itemApreendido.descricao || ''}</textarea>
                </div>
            </div>
        </div>

        <div class="modal-form-section">
            <h3 class="modal-section-title">Dados do Proprietário</h3>
            <div class="modal-form-grid">
                <div class="modal-form-group">
                    <label>Nome Completo</label>
                    <input type="text" id="edit-nomeProprietario" value="${currentOccurrence.proprietario.nome}" ${!editable ? 'disabled' : ''}>
                </div>
                <div class="modal-form-group">
                    <label>Data de Nascimento</label>
                    <input type="text" id="edit-dataNascimento" value="${formatDateBR(currentOccurrence.proprietario.dataNascimento)}" ${!editable ? 'disabled' : ''}>
                </div>
                <div class="modal-form-group">
                    <label>Tipo de Documento</label>
                    <input type="text" id="edit-tipoDocumento" value="${currentOccurrence.proprietario.tipoDocumento}" ${!editable ? 'disabled' : ''}>
                </div>
                <div class="modal-form-group">
                    <label>Nº Documento</label>
                    <input type="text" id="edit-numeroDocumento" value="${currentOccurrence.proprietario.numeroDocumento}" ${!editable ? 'disabled' : ''}>
                </div>
            </div>
        </div>

        <div class="modal-form-section">
            <h3 class="modal-section-title">Dados do Policial</h3>
            <div class="modal-form-grid">
                <div class="modal-form-group">
                    <label>Nome Completo</label>
                    <input type="text" id="edit-nomePolicial" value="${currentOccurrence.policial.nome}" ${!editable ? 'disabled' : ''}>
                </div>
                <div class="modal-form-group">
                    <label>Matrícula</label>
                    <input type="text" id="edit-matricula" value="${currentOccurrence.policial.matricula}" ${!editable ? 'disabled' : ''}>
                </div>
                <div class="modal-form-group">
                    <label>Graduação</label>
                    <input type="text" id="edit-graduacao" value="${currentOccurrence.policial.graduacao}" ${!editable ? 'disabled' : ''}>
                </div>
                <div class="modal-form-group">
                    <label>Unidade</label>
                    <input type="text" id="edit-unidadePolicial" value="${currentOccurrence.policial.unidade}" ${!editable ? 'disabled' : ''}>
                </div>
            </div>
        </div>

        <div class="modal-form-section">
            <h3 class="modal-section-title">Informações do Registro</h3>
            <div class="modal-form-grid">
                <div class="modal-form-group">
                    <label>Registrado Por</label>
                    <input type="text" value="${currentOccurrence.metadata.registradoPor}" disabled>
                </div>
                <div class="modal-form-group">
                    <label>Data do Registro</label>
                    <input type="text" value="${formatDateTime(currentOccurrence.metadata.dataRegistro)}" disabled>
                </div>
            </div>
        </div>
    `;

    btnDelete.style.display = 'none'; // Sempre oculto no modal de edição
    btnSaveEdit.style.display = editable ? 'inline-flex' : 'none';
    
    viewModal.classList.add('active');
}

// Close modal
function closeModal() {
    viewModal.classList.remove('active');
    currentOccurrence = null;
    isEditMode = false;
}

// Save edit
async function saveEdit() {
    if (!currentOccurrence) return;

    const updatedData = {
        id: currentOccurrence.id,
        ocorrencia: {
            numeroGenesis: document.getElementById('edit-numeroGenesis').value,
            unidade: document.getElementById('edit-unidade').value,
            dataApreensao: brDateToISO(document.getElementById('edit-dataApreensao').value),
            leiInfrigida: document.getElementById('edit-leiInfrigida').value,
            artigo: document.getElementById('edit-artigo').value,
            policialCondutor: document.getElementById('edit-policialCondutor').value
        },
        itemApreendido: {
            especie: document.getElementById('edit-especie').value,
            item: document.getElementById('edit-item').value,
            quantidade: document.getElementById('edit-quantidade').value.split(' ')[0],
            unidadeMedida: currentOccurrence.itemApreendido.unidadeMedida,
            descricao: document.getElementById('edit-descricao').value
        },
        proprietario: {
            nome: document.getElementById('edit-nomeProprietario').value,
            dataNascimento: brDateToISO(document.getElementById('edit-dataNascimento').value),
            tipoDocumento: document.getElementById('edit-tipoDocumento').value,
            numeroDocumento: document.getElementById('edit-numeroDocumento').value
        },
        policial: {
            nome: document.getElementById('edit-nomePolicial').value,
            matricula: document.getElementById('edit-matricula').value,
            graduacao: document.getElementById('edit-graduacao').value,
            unidade: document.getElementById('edit-unidadePolicial').value
        },
        metadata: currentOccurrence.metadata
    };

    showLoading('Atualizando ocorrência', 'Salvando alterações...');
    try {
        const result = await ipcRenderer.invoke('update-occurrence', updatedData);
        hideLoading();
        if (result.success) {
            customAlert.success('Ocorrência atualizada com sucesso!');
            closeModal();
            loadOccurrences();
        } else {
            customAlert.error('Erro ao atualizar: ' + result.message);
        }
    } catch (error) {
        console.error('Erro ao atualizar:', error);
        hideLoading();
        customAlert.error('Erro ao atualizar ocorrência');
    }
}

// Open delete modal
window.confirmDelete = function(index) {
    currentOccurrence = filteredOccurrences[index];
    deleteOccurrenceId.textContent = currentOccurrence.ocorrencia.numeroGenesis;
    deleteModal.classList.add('active');
};

// Execute delete occurrence
async function executeDelete() {
    if (!currentOccurrence) return;

    showLoading('Excluindo ocorrência', 'Removendo do sistema...');
    try {
        const result = await ipcRenderer.invoke('delete-occurrence', currentOccurrence.ocorrencia.numeroGenesis);
        hideLoading();
        if (result.success) {
            customAlert.success('Ocorrência excluída com sucesso!');
            deleteModal.classList.remove('active');
            closeModal();
            loadOccurrences();
        } else {
            customAlert.error('Erro ao excluir: ' + result.message);
        }
    } catch (error) {
        console.error('Erro ao excluir:', error);
        hideLoading();
        customAlert.error('Erro ao excluir ocorrência');
    }
}

// Open print modal
window.openPrintModal = function(index) {
    currentOccurrence = filteredOccurrences[index];
    printOccurrenceId.textContent = currentOccurrence.ocorrencia.numeroGenesis;
    printModal.classList.add('active');
};

// Close print modal
function closePrintModal() {
    printModal.classList.remove('active');
}

// Print Termo de Apreensão
async function printTermoApreensao() {
    if (!currentOccurrence) return;
    
    printModal.classList.remove('active');
    showLoading('Gerando documento', 'Criando Termo de Apreensão...');
    
    try {
        closePrintModal();
        
        // Gerar e exibir prévia do documento
        const result = await ipcRenderer.invoke('print-termo-apreensao', currentOccurrence);
        hideLoading();
        if (!result.success) {
            customAlert.error('Erro ao gerar documento: ' + result.message);
        }
    } catch (error) {
        console.error('Erro ao gerar documento:', error);
        hideLoading();
        customAlert.error('Erro ao gerar documento');
    }
}

// Export to Excel
async function exportToExcel() {
    showLoading('Exportando dados', 'Gerando arquivo Excel...');
    try {
        const result = await ipcRenderer.invoke('export-occurrences');
        hideLoading();
        if (result.success) {
            customAlert.success('Arquivo Excel exportado com sucesso!<br><br><strong>Local:</strong> ' + result.filePath);
        } else {
            customAlert.error('Erro ao exportar: ' + result.message);
        }
    } catch (error) {
        console.error('Erro ao exportar:', error);
        hideLoading();
        customAlert.error('Erro ao exportar arquivo');
    }
}

// Search
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    if (!query) {
        filteredOccurrences = [...allOccurrences];
    } else {
        filteredOccurrences = allOccurrences.filter(occ => {
            try {
                // Tentar diferentes possíveis estruturas de dados
                let numeroGenesis = '';
                
                if (occ.ocorrencia?.numeroGenesis) {
                    numeroGenesis = occ.ocorrencia.numeroGenesis;
                }
                else if (occ.numeroGenesis) {
                    numeroGenesis = occ.numeroGenesis;
                }
                else if (occ['Nº Genesis']) {
                    numeroGenesis = occ['Nº Genesis'];
                }
                else if (occ['numeroGenesis']) {
                    numeroGenesis = occ['numeroGenesis'];
                }
                else if (occ['numero_genesis']) {
                    numeroGenesis = occ['numero_genesis'];
                }
                
                const numeroGenesisLower = (numeroGenesis || '').toString().toLowerCase();
                return numeroGenesisLower.includes(query);
            } catch (error) {
                console.error('Erro ao filtrar ocorrência:', error, occ);
                return false;
            }
        });
    }
    
    renderTable();
});

// Tab navigation
tabDashboard.addEventListener('click', () => {
    setActiveTab('dashboard');
});

tabOcorrencias.addEventListener('click', () => {
    setActiveTab('ocorrencias');
});

tabNovaOcorrencia.addEventListener('click', () => {
    ipcRenderer.send('load-panel');
});

function setActiveTab(tab) {
    // Remove active from all tabs
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    
    // Hide all sections
    sectionDashboard.style.display = 'none';
    sectionOcorrencias.style.display = 'none';
    
    if (tab === 'dashboard') {
        tabDashboard.classList.add('active');
        sectionDashboard.style.display = 'block';
    } else if (tab === 'ocorrencias') {
        tabOcorrencias.classList.add('active');
        sectionOcorrencias.style.display = 'block';
    }
}

// User menu
userMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle('active');
});

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

// Modal events
modalClose.addEventListener('click', closeModal);
btnCancelEdit.addEventListener('click', closeModal);
btnSaveEdit.addEventListener('click', saveEdit);
// Botão de deletar removido do modal de edição

deleteModalClose.addEventListener('click', () => {
    deleteModal.classList.remove('active');
});
btnCancelDelete.addEventListener('click', () => {
    deleteModal.classList.remove('active');
});
btnConfirmDelete.addEventListener('click', executeDelete);

printModalClose.addEventListener('click', closePrintModal);
btnCancelPrint.addEventListener('click', closePrintModal);
btnPrintTermoApreensao.addEventListener('click', printTermoApreensao);

// Refresh button
refreshBtn.addEventListener('click', async () => {
    refreshBtn.classList.add('loading');
    refreshBtn.disabled = true;
    
    try {
        await loadOccurrences();
        // Pequeno delay para mostrar a animação
        setTimeout(() => {
            refreshBtn.classList.remove('loading');
            refreshBtn.disabled = false;
        }, 500);
    } catch (error) {
        console.error('Erro ao atualizar:', error);
        refreshBtn.classList.remove('loading');
        refreshBtn.disabled = false;
    }
});

// Export button
exportBtn.addEventListener('click', exportToExcel);

// Empty state button
btnNovaOcorrenciaEmpty.addEventListener('click', () => {
    ipcRenderer.send('load-panel');
});

// Close modal on outside click
viewModal.addEventListener('click', (e) => {
    if (e.target === viewModal) {
        closeModal();
    }
});

deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
        deleteModal.classList.remove('active');
    }
});

printModal.addEventListener('click', (e) => {
    if (e.target === printModal) {
        closePrintModal();
    }
});

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function formatDateBR(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
}

function brDateToISO(brDate) {
    const [day, month, year] = brDate.split('/');
    return `${year}-${month}-${day}`;
}

function showEmptyState() {
    document.querySelector('.table-container').style.display = 'none';
    emptyState.style.display = 'block';
}

function hideEmptyState() {
    document.querySelector('.table-container').style.display = 'block';
    emptyState.style.display = 'none';
}

// Update charts
function updateCharts() {
    createLineChart();
    createBarChart();
    createDoughnutChart();
}

// Create line chart - Occurrences over last 30 days
function createLineChart() {
    const ctx = document.getElementById('lineChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (lineChart) {
        lineChart.destroy();
    }
    
    // Get last 30 days data
    const last30Days = [];
    const counts = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        last30Days.push(dateStr);
        
        const count = allOccurrences.filter(occ => {
            if (!occ.metadata?.dataRegistro) return false;
            const occDate = new Date(occ.metadata.dataRegistro);
            return occDate.toDateString() === date.toDateString();
        }).length;
        counts.push(count);
    }
    
    lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last30Days,
            datasets: [{
                label: 'Ocorrências',
                data: counts,
                borderColor: '#279b4d',
                backgroundColor: 'rgba(39, 155, 77, 0.1)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#279b4d',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#071d49',
                    padding: 12,
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#fac709',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: '#666'
                    },
                    grid: {
                        color: '#f0f2f5'
                    }
                },
                x: {
                    ticks: {
                        color: '#666',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Create bar chart - Occurrences by unit
function createBarChart() {
    const ctx = document.getElementById('barChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (barChart) {
        barChart.destroy();
    }
    
    // Count by unit
    const unitCounts = {};
    allOccurrences.forEach(occ => {
        const unit = occ.ocorrencia?.unidade || 'Não especificado';
        unitCounts[unit] = (unitCounts[unit] || 0) + 1;
    });
    
    // Sort and get top 10
    const sortedUnits = Object.entries(unitCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    const labels = sortedUnits.map(([unit]) => unit);
    const data = sortedUnits.map(([, count]) => count);
    
    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ocorrências',
                data: data,
                backgroundColor: '#071d49',
                borderColor: '#071d49',
                borderWidth: 1,
                borderRadius: 6,
                hoverBackgroundColor: '#fac709'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#071d49',
                    padding: 12,
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#fac709',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: '#666'
                    },
                    grid: {
                        color: '#f0f2f5'
                    }
                },
                x: {
                    ticks: {
                        color: '#666',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Create doughnut chart - Item types
function createDoughnutChart() {
    const ctx = document.getElementById('doughnutChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (doughnutChart) {
        doughnutChart.destroy();
    }
    
    // Count by item type
    const itemCounts = {};
    allOccurrences.forEach(occ => {
        const item = occ.itemApreendido?.item || 'Não especificado';
        itemCounts[item] = (itemCounts[item] || 0) + 1;
    });
    
    // Sort and get top 8
    const sortedItems = Object.entries(itemCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    
    const labels = sortedItems.map(([item]) => item);
    const data = sortedItems.map(([, count]) => count);
    
    const colors = [
        '#071d49',
        '#279b4d',
        '#fac709',
        '#c33',
        '#1976d2',
        '#f57c00',
        '#7b1fa2',
        '#00897b'
    ];
    
    doughnutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: '#fff',
                borderWidth: 2,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        color: '#666',
                        font: {
                            size: 12
                        },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: '#071d49',
                    padding: 12,
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#fac709',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}
