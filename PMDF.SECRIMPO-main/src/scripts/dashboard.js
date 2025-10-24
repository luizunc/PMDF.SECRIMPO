const { ipcRenderer } = require('electron');
const Chart = require('chart.js/auto');

// Elements
const userInfo = document.getElementById('userInfo');
const userMenuBtn = document.getElementById('userMenuBtn');
const userDropdown = document.getElementById('userDropdown');
const logoutBtn = document.getElementById('logoutBtn');

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

// State
let allOccurrences = [];
let filteredOccurrences = [];
let currentOccurrence = null;
let isEditMode = false;

// Utility functions
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function formatDateBR(dateString) {
    if (!dateString) return '';
    // Se já está no formato dd/mm/yyyy, retorna como está
    if (dateString.includes('/')) return dateString;
    // Se está no formato ISO, converte
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function brDateToISO(brDate) {
    if (!brDate) return '';
    const [day, month, year] = brDate.split('/');
    return `${year}-${month}-${day}`;
}

// Função para extrair valor do peso de forma robusta
function getPesoValue(occurrence) {
    // Primeiro, tenta pegar o campo peso diretamente
    if (occurrence.itemApreendido && occurrence.itemApreendido.peso) {
        const unidade = occurrence.itemApreendido.unidadeMedida || '';
        return occurrence.itemApreendido.peso + (unidade ? ' ' + unidade : '');
    }

    // Se não tem campo peso, mas tem quantidade e unidade de peso, usa esses
    if (occurrence.itemApreendido && occurrence.itemApreendido.quantidade && occurrence.itemApreendido.unidadeMedida) {
        const unidades = ['mg', 'g', 'kg', 't'];
        if (unidades.includes(occurrence.itemApreendido.unidadeMedida.toLowerCase())) {
            return occurrence.itemApreendido.quantidade + ' ' + occurrence.itemApreendido.unidadeMedida;
        }
    }

    return '-';
}

// Função para extrair número de série de forma robusta
function getNumeroSerieValue(occurrence) {
    // Tenta diferentes possíveis nomes do campo
    if (occurrence.itemApreendido) {
        return occurrence.itemApreendido.numeroSerie ||
            occurrence.itemApreendido.numero_serie ||
            occurrence.itemApreendido.numeroserie ||
            '-';
    }
    return '-';
}

// Função para extrair valor monetário de forma robusta
function getValorValue(occurrence) {
    if (occurrence.itemApreendido && occurrence.itemApreendido.valor) {
        const valor = occurrence.itemApreendido.valor.toString();
        // Se já tem R$, retorna como está
        if (valor.includes('R$')) {
            return valor;
        }
        // Se não tem R$, adiciona
        return 'R$ ' + valor;
    }
    return '-';
}

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

// Load occurrences
async function loadOccurrences() {
    try {
        const result = await ipcRenderer.invoke('get-occurrences');
        if (result.success) {
            allOccurrences = result.data;
            filteredOccurrences = [...allOccurrences];
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
        const occDate = new Date(occ.metadata.dataRegistro);
        return occDate.getMonth() === now.getMonth() &&
            occDate.getFullYear() === now.getFullYear();
    }).length;
    statMes.textContent = thisMonth;

    // Count today
    const today = allOccurrences.filter(occ => {
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
            <td><strong>${occ.ocorrencia.numeroGenesis}</strong></td>
            <td>${formatDate(occ.ocorrencia.dataApreensao)}</td>
            <td>${occ.ocorrencia.unidade}</td>
            <td>${occ.proprietario.nome}</td>
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
                    <button class="btn-action btn-label" onclick="showLabel(${index})" title="Etiqueta de Apreensão">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                            <line x1="7" y1="7" x2="7.01" y2="7"/>
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
window.viewOccurrence = function (index) {
    currentOccurrence = filteredOccurrences[index];
    isEditMode = false;
    showModal(false);
};

// Edit occurrence
window.editOccurrence = function (index) {
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
                    <input type="text" id="edit-unidade" value="${currentOccurrence.ocorrencia.unidade}" ${!editable ? 'disabled' : ''}>
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
                    <input type="text" id="edit-quantidade" value="${currentOccurrence.itemApreendido.quantidade || ''}" ${!editable ? 'disabled' : ''}>
                </div>
                <div class="modal-form-group">
                    <label>Unidade de Medida</label>
                    <input type="text" id="edit-unidadeMedida" value="${currentOccurrence.itemApreendido.unidadeMedida || ''}" ${!editable ? 'disabled' : ''}>
                </div>
                <div class="modal-form-group">
                    <label>Peso</label>
                    <input type="text" id="edit-peso" value="${currentOccurrence.itemApreendido.peso || ''}" ${!editable ? 'disabled' : ''}>
                </div>
                <div class="modal-form-group">
                    <label>Valor (R$)</label>
                    <input type="text" id="edit-valor" value="${currentOccurrence.itemApreendido.valor || ''}" ${!editable ? 'disabled' : ''}>
                </div>
                <div class="modal-form-group">
                    <label>Número de Série</label>
                    <input type="text" id="edit-numeroSerie" value="${currentOccurrence.itemApreendido.numeroSerie || ''}" ${!editable ? 'disabled' : ''}>
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

    btnDelete.style.display = editable ? 'inline-flex' : 'none';
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
            quantidade: document.getElementById('edit-quantidade').value,
            unidadeMedida: document.getElementById('edit-unidadeMedida').value,
            peso: document.getElementById('edit-peso').value,
            descricao: document.getElementById('edit-descricao').value,
            valor: document.getElementById('edit-valor').value,
            numeroSerie: document.getElementById('edit-numeroSerie').value
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

    try {
        const result = await ipcRenderer.invoke('update-occurrence', updatedData);
        if (result.success) {
            alert('Ocorrência atualizada com sucesso!');
            closeModal();
            loadOccurrences();
        } else {
            alert('Erro ao atualizar ocorrência: ' + result.message);
        }
    } catch (error) {
        alert('Erro ao atualizar ocorrência: ' + error.message);
    }
}

// Confirm delete
window.confirmDelete = function (index) {
    currentOccurrence = filteredOccurrences[index];
    deleteOccurrenceId.textContent = currentOccurrence.ocorrencia.numeroGenesis;
    deleteModal.classList.add('active');
};

// Delete occurrence
async function deleteOccurrence() {
    if (!currentOccurrence) return;

    try {
        const result = await ipcRenderer.invoke('delete-occurrence', currentOccurrence.ocorrencia.numeroGenesis);
        if (result.success) {
            alert('Ocorrência excluída com sucesso!');
            deleteModal.classList.remove('active');
            viewModal.classList.remove('active');
            currentOccurrence = null;
            loadOccurrences();
        } else {
            alert('Erro ao excluir ocorrência: ' + result.message);
        }
    } catch (error) {
        alert('Erro ao excluir ocorrência: ' + error.message);
    }
}

// Export to Excel
async function exportToExcel() {
    try {
        const result = await ipcRenderer.invoke('export-occurrences');
        if (result.success) {
            alert('Arquivo Excel exportado com sucesso!\n\nLocal: ' + result.filePath);
        } else {
            alert('Erro ao exportar: ' + result.message);
        }
    } catch (error) {
        alert('Erro ao exportar: ' + error.message);
    }
}

// Search
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();

    if (!query) {
        filteredOccurrences = [...allOccurrences];
    } else {
        filteredOccurrences = allOccurrences.filter(occ => {
            return occ.ocorrencia.numeroGenesis.toLowerCase().includes(query) ||
                occ.ocorrencia.unidade.toLowerCase().includes(query) ||
                occ.proprietario.nome.toLowerCase().includes(query) ||
                occ.policial.nome.toLowerCase().includes(query) ||
                occ.itemApreendido.item.toLowerCase().includes(query);
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
    if (confirm('Deseja realmente sair do sistema?')) {
        sessionStorage.clear();
        ipcRenderer.send('logout');
    }
});

// Modal events
modalClose.addEventListener('click', closeModal);
btnCancelEdit.addEventListener('click', closeModal);
btnSaveEdit.addEventListener('click', saveEdit);
btnDelete.addEventListener('click', () => {
    closeModal();
    confirmDelete(filteredOccurrences.indexOf(currentOccurrence));
});

deleteModalClose.addEventListener('click', () => {
    deleteModal.classList.remove('active');
});
btnCancelDelete.addEventListener('click', () => {
    deleteModal.classList.remove('active');
});
btnConfirmDelete.addEventListener('click', deleteOccurrence);

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
        const unit = occ.ocorrencia.unidade;
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
        const item = occ.itemApreendido.item;
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
                        label: function (context) {
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
// Show label modal
window.showLabel = function (index) {
    const occurrence = filteredOccurrences[index];
    if (!occurrence) return;

    // Debug: verificar estrutura dos dados
    console.log('Dados da ocorrência:', occurrence);
    console.log('Item apreendido:', occurrence.itemApreendido);
    console.log('Peso:', occurrence.itemApreendido?.peso);
    console.log('Número de série:', occurrence.itemApreendido?.numeroSerie);
    console.log('Valor:', occurrence.itemApreendido?.valor);

    // Create label modal
    const labelModal = document.createElement('div');
    labelModal.className = 'modal label-modal';
    labelModal.id = 'labelModal';

    labelModal.innerHTML = `
        <div class="modal-content label-modal-content">
            <div class="modal-header">
                <h2>Etiqueta de Apreensão</h2>
                <button class="modal-close" onclick="closeLabelModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="label-container">
                    <div class="label-header">
                        <div class="label-logos">
                            <img src="../../assets/PMDF_LetraPreta.png" alt="PMDF" class="label-logo-left">
                            <div class="label-title">
                                <div class="label-title-main">GOVERNO DO DISTRITO FEDERAL</div>
                                <div class="label-title-sub">POLÍCIA MILITAR DO DISTRITO FEDERAL</div>
                                <div class="label-title-sub">II COMANDO DE POLICIAMENTO</div>
                                <div class="label-title-sub">REGIONAL OESTE</div>
                            </div>
                            <img src="../../assets/GDF_logo.jpg" alt="GDF" class="label-logo-right">
                        </div>
                    </div>
                    
                    <div class="label-content">
                        <div class="label-row">
                            <div class="label-field label-field-dark">
                                <div class="label-field-title">NÚMERO GÊNESIS</div>
                                <div class="label-field-value">${occurrence.ocorrencia.numeroGenesis}</div>
                            </div>
                            <div class="label-field label-field-dark">
                                <div class="label-field-title">DATA DA APREENSÃO</div>
                                <div class="label-field-value">${formatDateBR(occurrence.ocorrencia.dataApreensao)}</div>
                            </div>
                        </div>
                        
                        <div class="label-row">
                            <div class="label-field label-field-dark">
                                <div class="label-field-title">ITEM APREENDIDO</div>
                                <div class="label-field-value">${occurrence.itemApreendido.item}</div>
                            </div>
                            <div class="label-field label-field-dark">
                                <div class="label-field-title">NOME DO ITEM</div>
                                <div class="label-field-value">${occurrence.itemApreendido.descricao || occurrence.itemApreendido.item}</div>
                            </div>
                        </div>
                        
                        <div class="label-row">
                            <div class="label-field label-field-dark">
                                <div class="label-field-title">QUANTIDADE</div>
                                <div class="label-field-value">${occurrence.itemApreendido.quantidade || '-'}</div>
                            </div>
                            <div class="label-field label-field-dark">
                                <div class="label-field-title">VALOR</div>
                                <div class="label-field-value">${getValorValue(occurrence)}</div>
                            </div>
                            <div class="label-field label-field-dark">
                                <div class="label-field-title">PESO</div>
                                <div class="label-field-value">${getPesoValue(occurrence)}</div>
                            </div>
                            <div class="label-field label-field-dark">
                                <div class="label-field-title">N. DE SÉRIE</div>
                                <div class="label-field-value">${getNumeroSerieValue(occurrence)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="closeLabelModal()">Fechar</button>
                <button class="btn-primary" onclick="printLabel()">Imprimir Etiqueta</button>
                <button class="btn-primary" onclick="printTermo()">Termo de Apreensão</button>
            </div>
        </div>
    `;

    document.body.appendChild(labelModal);
    labelModal.style.display = 'flex';
};

// Close label modal
window.closeLabelModal = function () {
    const labelModal = document.getElementById('labelModal');
    if (labelModal) {
        labelModal.remove();
    }
};

// Print label
window.printLabel = function () {
    const labelContent = document.querySelector('.label-container');
    if (!labelContent) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Etiqueta de Apreensão</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        margin: 20px; 
                        background: white;
                    }
                    .label-container {
                        border: 2px solid #000;
                        padding: 20px;
                        max-width: 800px;
                        margin: 0 auto;
                        background: white;
                    }
                    .label-header {
                        margin-bottom: 20px;
                    }
                    .label-logos {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        margin-bottom: 20px;
                    }
                    .label-logo-left, .label-logo-right {
                        width: 80px;
                        height: 80px;
                        object-fit: contain;
                    }
                    .label-title {
                        text-align: center;
                        flex: 1;
                        margin: 0 20px;
                    }
                    .label-title-main {
                        font-size: 16px;
                        font-weight: bold;
                        margin-bottom: 5px;
                    }
                    .label-title-sub {
                        font-size: 14px;
                        font-weight: bold;
                        margin-bottom: 2px;
                    }
                    .label-row {
                        display: flex;
                        margin-bottom: 10px;
                        gap: 10px;
                    }
                    .label-field {
                        flex: 1;
                        border: 1px solid #000;
                        min-height: 40px;
                    }
                    .label-field-title {
                        background: #000;
                        color: white;
                        padding: 5px 10px;
                        font-size: 12px;
                        font-weight: bold;
                        text-align: center;
                    }
                    .label-field-value {
                        padding: 10px;
                        font-size: 14px;
                        font-weight: bold;
                        text-align: center;
                        min-height: 20px;
                    }
                    @media print {
                        body { margin: 0; }
                        .label-container { border: 2px solid #000; }
                    }
                </style>
            </head>
            <body>
                ${labelContent.outerHTML}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
};

// Print termo de apreensão
window.printTermo = function () {
    const labelModal = document.getElementById('labelModal');
    if (!labelModal) return;

    // Buscar dados da ocorrência atual
    const occurrence = filteredOccurrences.find(occ =>
        occ.ocorrencia.numeroGenesis === document.querySelector('.label-field-value').textContent
    );

    if (!occurrence) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Termo de Apreensão</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        margin: 20px; 
                        background: white;
                        font-size: 12px;
                    }
                    .termo-container {
                        max-width: 800px;
                        margin: 0 auto;
                        background: white;
                        padding: 20px;
                    }
                    .termo-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        margin-bottom: 30px;
                    }
                    .termo-logo-left, .termo-logo-right {
                        width: 80px;
                        height: 80px;
                        object-fit: contain;
                    }
                    .termo-title-section {
                        text-align: center;
                        flex: 1;
                        margin: 0 20px;
                    }
                    .termo-title-main {
                        font-size: 14px;
                        font-weight: bold;
                        margin-bottom: 3px;
                    }
                    .termo-title-sub {
                        font-size: 12px;
                        font-weight: bold;
                        margin-bottom: 2px;
                    }
                    .termo-main-title {
                        text-align: center;
                        font-size: 18px;
                        font-weight: bold;
                        margin: 30px 0;
                    }
                    .codigo-objeto {
                        border: 2px solid #000;
                        padding: 5px;
                        margin-bottom: 20px;
                        display: inline-block;
                    }
                    .codigo-label {
                        background: #000;
                        color: white;
                        padding: 3px 8px;
                        font-size: 10px;
                        font-weight: bold;
                        margin-bottom: 5px;
                    }
                    .codigo-value {
                        padding: 5px;
                        min-height: 20px;
                        border: 1px solid #000;
                        margin-top: 5px;
                    }
                    .section-title {
                        font-size: 14px;
                        font-weight: bold;
                        margin: 20px 0 10px 0;
                    }
                    .form-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    .form-table td {
                        border: 1px solid #000;
                        padding: 5px;
                        vertical-align: top;
                    }
                    .field-header {
                        background: #000;
                        color: white;
                        font-weight: bold;
                        text-align: center;
                        font-size: 10px;
                        padding: 3px;
                    }
                    .field-value {
                        min-height: 25px;
                        padding: 5px;
                        font-size: 11px;
                    }
                    .description-field {
                        min-height: 80px;
                    }
                    .signature-section {
                        text-align: center;
                        margin-top: 40px;
                    }
                    .signature-line {
                        border-bottom: 1px solid #000;
                        width: 300px;
                        margin: 30px auto 10px auto;
                    }
                    .footer-text {
                        text-align: center;
                        font-size: 10px;
                        margin-top: 40px;
                        font-style: italic;
                    }
                    @media print {
                        body { margin: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="termo-container">
                    <div class="termo-header">
                        <img src="../../assets/PMDF_LetraPreta.png" alt="PMDF" class="termo-logo-left">
                        <div class="termo-title-section">
                            <div class="termo-title-main">GOVERNO DO DISTRITO FEDERAL</div>
                            <div class="termo-title-sub">POLÍCIA MILITAR DO DISTRITO FEDERAL</div>
                        </div>
                        <img src="../../assets/GDF_logo.jpg" alt="GDF" class="termo-logo-right">
                    </div>
                    
                    <div class="termo-main-title">TERMO DE APREENSÃO</div>
                    
                    <div class="codigo-objeto">
                        <div class="codigo-label">CÓDIGO DO OBJETO</div>
                        <div class="codigo-value">${occurrence.ocorrencia.numeroGenesis}</div>
                    </div>
                    
                    <div class="section-title">DADOS GERAIS DA OCORRÊNCIA</div>
                    <table class="form-table">
                        <tr>
                            <td style="width: 20%;">
                                <div class="field-header">NÚMERO GÊNESIS</div>
                                <div class="field-value">${occurrence.ocorrencia.numeroGenesis}</div>
                            </td>
                            <td style="width: 20%;">
                                <div class="field-header">NÚMERO CIADE</div>
                                <div class="field-value">-</div>
                            </td>
                            <td style="width: 20%;">
                                <div class="field-header">DATA DA APREENSÃO</div>
                                <div class="field-value">${formatDateBR(occurrence.ocorrencia.dataApreensao)}</div>
                            </td>
                            <td style="width: 20%;">
                                <div class="field-header">UNIDADE</div>
                                <div class="field-value">${occurrence.ocorrencia.unidade}</div>
                            </td>
                        </tr>
                        <tr>
                            <td style="width: 30%;">
                                <div class="field-header">FUNDAMENTAÇÃO LEGAL</div>
                                <div class="field-value">${occurrence.ocorrencia.leiInfrigida}</div>
                            </td>
                            <td style="width: 15%;">
                                <div class="field-header">ARTIGO</div>
                                <div class="field-value">${occurrence.ocorrencia.artigo}</div>
                            </td>
                            <td style="width: 35%;">
                                <div class="field-header">POLICIAL RESPONSÁVEL PELA APREENSÃO</div>
                                <div class="field-value">${occurrence.policial.nome}</div>
                            </td>
                            <td style="width: 20%;">
                                <div class="field-header">MATRÍCULA</div>
                                <div class="field-value">${occurrence.policial.matricula}</div>
                            </td>
                        </tr>
                    </table>
                    
                    <div class="section-title">DADOS DO BEM APREENDIDO</div>
                    <table class="form-table">
                        <tr>
                            <td style="width: 25%;">
                                <div class="field-header">ITEM APREENDIDO</div>
                                <div class="field-value">${occurrence.itemApreendido.item}</div>
                            </td>
                            <td style="width: 25%;">
                                <div class="field-header">NOME DO ITEM</div>
                                <div class="field-value">${occurrence.itemApreendido.descricao || occurrence.itemApreendido.item}</div>
                            </td>
                            <td style="width: 25%;">
                                <div class="field-header">VALOR</div>
                                <div class="field-value">${getValorValue(occurrence)}</div>
                            </td>
                            <td style="width: 25%;">
                                <div class="field-header">QUANTIDADE</div>
                                <div class="field-value">${occurrence.itemApreendido.quantidade || '-'}</div>
                            </td>
                        </tr>
                        <tr>
                            <td style="width: 25%;">
                                <div class="field-header">PESO</div>
                                <div class="field-value">${getPesoValue(occurrence)}</div>
                            </td>
                            <td style="width: 50%;">
                                <div class="field-header">NÚMERO DE SÉRIE</div>
                                <div class="field-value">${getNumeroSerieValue(occurrence)}</div>
                            </td>
                            <td style="width: 25%;">
                                <div class="field-header">ESTADO DO BEM</div>
                                <div class="field-value">-</div>
                            </td>
                        </tr>
                        <tr>
                            <td colspan="4">
                                <div class="field-header">DESCRIÇÃO DO OBJETO</div>
                                <div class="field-value description-field">${occurrence.itemApreendido.descricao || ''}</div>
                            </td>
                        </tr>
                    </table>
                    
                    <div class="signature-section">
                        <div>Chefe da Seção de Crimes de Menor Potencial</div>
                        <div>Ofensivo (SECRIMPO) -</div>
                        <div class="signature-line"></div>
                    </div>
                    
                    <div class="footer-text">
                        Brasília - "Patrimônio cultural da humanidade"
                    </div>
                </div>
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
};