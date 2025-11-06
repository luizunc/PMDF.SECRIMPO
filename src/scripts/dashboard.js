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
const statUsuarios = document.getElementById('statUsuarios');

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

const attachModal = document.getElementById('attachModal');
const attachModalClose = document.getElementById('attachModalClose');
const attachOccurrenceId = document.getElementById('attachOccurrenceId');
const btnCancelAttach = document.getElementById('btnCancelAttach');
// btnSelectPDF removido - não existe no HTML
const pdfFileInput = document.getElementById('pdfFileInput');
const selectedFileName = document.getElementById('selectedFileName');
const btnUploadPDF = document.getElementById('btnUploadPDF');

// State
let allOccurrences = [];
let filteredOccurrences = [];
let currentOccurrence = null;
let isEditMode = false;

// Cache para anexos
let attachmentsCache = new Map();

// Charts - Ocorrências Gerais
let lineChart = null;
let pieChartMonth = null;
let barChartDay = null;

// Charts - Unidade
let pieChartUnidadePeriodo = null;
let pieChartUnidadeMes = null;
let barChartUnidadeDia = null;

// Charts - Itens
let pieChartItensPeriodo = null;
let pieChartItensMes = null;
let barChartItensDia = null;

// Date filter
let customDateRange = null; // { startDate: Date, endDate: Date }
const filterDataInicio = document.getElementById('filterDataInicio');
const filterDataFim = document.getElementById('filterDataFim');
const btnFilterChart = document.getElementById('btnFilterChart');
const btnResetFilter = document.getElementById('btnResetFilter');

// Date filter for Unidade chart
let customDateRangeUnidade = null;
const filterDataInicioUnidade = document.getElementById('filterDataInicioUnidade');
const filterDataFimUnidade = document.getElementById('filterDataFimUnidade');
const btnFilterChartUnidade = document.getElementById('btnFilterChartUnidade');
const btnResetFilterUnidade = document.getElementById('btnResetFilterUnidade');

// Date filter for Itens chart
let customDateRangeItens = null;
const filterDataInicioItens = document.getElementById('filterDataInicioItens');
const filterDataFimItens = document.getElementById('filterDataFimItens');
const btnFilterChartItens = document.getElementById('btnFilterChartItens');
const btnResetFilterItens = document.getElementById('btnResetFilterItens');

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

    // Update active users count from KeyAuth
    updateActiveUsers();

    // Update charts
    updateCharts();
}

// Update active users count from KeyAuth
async function updateActiveUsers() {
    try {
        if (window.electron && window.electron.ipcRenderer) {
            const count = await window.electron.ipcRenderer.invoke('get-active-users-count');
            if (statUsuarios) {
                statUsuarios.textContent = count || 1;
            }
        } else {
            // Fallback: show 1 (current user)
            if (statUsuarios) {
                statUsuarios.textContent = 1;
            }
        }
    } catch (error) {
        console.error('Erro ao buscar usuários ativos:', error);
        // Fallback: show 1 (current user)
        if (statUsuarios) {
            statUsuarios.textContent = 1;
        }
    }
}

// Render table
function renderTable() {
    if (filteredOccurrences.length === 0) {
        showEmptyState();
        return;
    }

    hideEmptyState();

    // Otimização: usar DocumentFragment para reduzir reflows
    const fragment = document.createDocumentFragment();

    // Limpar tabela de forma otimizada
    while (occurrencesTableBody.firstChild) {
        occurrencesTableBody.removeChild(occurrencesTableBody.firstChild);
    }

    filteredOccurrences.forEach((occ, index) => {
        const row = document.createElement('tr');
        
        // Indicador de anexos (será atualizado dinamicamente)
        const attachmentIndicator = `<span class="attachment-indicator" id="attachment-${index}"></span>`;
        
        row.innerHTML = `
            <td>
                <div class="occurrence-number">
                    <strong>${occ.ocorrencia?.numeroGenesis || 'N/A'}</strong>
                    ${attachmentIndicator}
                </div>
            </td>
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
        fragment.appendChild(row);
    });

    // Adicionar todas as linhas de uma vez para reduzir reflows
    occurrencesTableBody.appendChild(fragment);
    
    // Verificar anexos para cada ocorrência
    checkAttachmentsForAllOccurrences();
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

    // Usar requestAnimationFrame para melhor performance
    requestAnimationFrame(() => {

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

        <div class="modal-form-section">
            <h3 class="modal-section-title">Anexos PDF</h3>
            <div class="attachments-list" id="attachmentsList">
                <div class="loading-attachments">
                    <span>Carregando anexos...</span>
                </div>
            </div>
            ${!editable ? `
                <div class="attachment-actions">
                    <button type="button" class="btn-primary btn-attach-new" onclick="openAttachModal(${filteredOccurrences.indexOf(currentOccurrence)})">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49"/>
                        </svg>
                        Anexar PDF
                    </button>
                </div>
            ` : ''}
        </div>
    `;

        btnDelete.style.display = 'none'; // Sempre oculto no modal de edição
        btnSaveEdit.style.display = editable ? 'inline-flex' : 'none';

        viewModal.classList.add('active');

        // Carregar anexos após abrir o modal
        if (!editable) {
            loadAttachments(currentOccurrence.ocorrencia.numeroGenesis);
        }
    });
}

// Load attachments from Google Drive
async function loadAttachments(numeroGenesis) {
    const attachmentsList = document.getElementById('attachmentsList');
    if (!attachmentsList) return;

    try {
        console.log('Carregando anexos para:', numeroGenesis);

        // Mostrar loading
        attachmentsList.innerHTML = '<div class="loading-attachments"><span>Carregando anexos...</span></div>';

        // Buscar anexos no Google Drive
        const result = await ipcRenderer.invoke('list-pdf-attachments', numeroGenesis);

        console.log('Anexos carregados:', result);

        if (result.success && result.attachments.length > 0) {
            attachmentsList.innerHTML = generateAttachmentsList(result.attachments);
        } else {
            attachmentsList.innerHTML = '<p class="no-attachments">Nenhum anexo PDF encontrado.</p>';
        }

    } catch (error) {
        console.error('Erro ao carregar anexos:', error);
        attachmentsList.innerHTML = '<p class="no-attachments error">Erro ao carregar anexos.</p>';
    }
}

// Check attachments for all occurrences in the table
async function checkAttachmentsForAllOccurrences() {
    const promises = filteredOccurrences.map(async (occ, index) => {
        try {
            const numeroGenesis = occ.ocorrencia?.numeroGenesis;
            if (!numeroGenesis) return;

            const indicator = document.getElementById(`attachment-${index}`);
            if (!indicator) return;

            // Verificar cache primeiro
            if (attachmentsCache.has(numeroGenesis)) {
                const cachedResult = attachmentsCache.get(numeroGenesis);
                updateIndicatorDisplay(indicator, cachedResult);
                return;
            }

            const result = await ipcRenderer.invoke('list-pdf-attachments', numeroGenesis);
            
            // Salvar no cache
            attachmentsCache.set(numeroGenesis, result);
            
            updateIndicatorDisplay(indicator, result);
        } catch (error) {
            console.error('Erro ao verificar anexos:', error);
            const indicator = document.getElementById(`attachment-${index}`);
            if (indicator) {
                // Em caso de erro, simplesmente ocultar o indicador
                indicator.style.display = 'none';
            }
        }
    });

    // Executar verificações em lotes para melhor performance
    const batchSize = 5;
    for (let i = 0; i < promises.length; i += batchSize) {
        const batch = promises.slice(i, i + batchSize);
        await Promise.all(batch);
        
        // Pequeno delay entre lotes para não sobrecarregar
        if (i + batchSize < promises.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
}

// Update indicator display
function updateIndicatorDisplay(indicator, result) {
    if (result.success && result.attachments && result.attachments.length > 0) {
        // Há anexos - mostrar clipe
        indicator.innerHTML = '📎';
        indicator.title = `${result.attachments.length} anexo(s) PDF`;
        indicator.className = 'attachment-indicator has-attachments';
        indicator.style.display = 'inline-flex';
    } else {
        // Sem anexos - ocultar completamente
        indicator.innerHTML = '';
        indicator.title = '';
        indicator.className = 'attachment-indicator no-attachments';
        indicator.style.display = 'none';
    }
}

// Update attachment indicator for a specific occurrence
async function updateAttachmentIndicator(numeroGenesis) {
    try {
        // Limpar cache para esta ocorrência para forçar atualização
        attachmentsCache.delete(numeroGenesis);
        
        const result = await ipcRenderer.invoke('list-pdf-attachments', numeroGenesis);
        
        // Atualizar cache
        attachmentsCache.set(numeroGenesis, result);
        
        // Encontrar o índice da ocorrência na tabela
        const occurrenceIndex = filteredOccurrences.findIndex(occ => 
            occ.ocorrencia?.numeroGenesis === numeroGenesis
        );
        
        if (occurrenceIndex !== -1) {
            const indicator = document.getElementById(`attachment-${occurrenceIndex}`);
            
            if (indicator) {
                updateIndicatorDisplay(indicator, result);
            }
        }
    } catch (error) {
        console.error('Erro ao atualizar indicador de anexo:', error);
    }
}

// Format file size
function formatFileSize(bytes) {
    if (!bytes) return 'Tamanho desconhecido';

    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';

    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// Generate attachments list HTML
function generateAttachmentsList(attachments) {
    if (!attachments || attachments.length === 0) {
        return '<p class="no-attachments">Nenhum anexo PDF encontrado.</p>';
    }

    return attachments.map(attachment => `
        <div class="attachment-item">
            <div class="attachment-info">
                <svg class="attachment-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                </svg>
                <div class="attachment-details">
                    <span class="attachment-name">${attachment.fileName}</span>
                    <span class="attachment-meta">
                        ${formatFileSize(attachment.size)} • ${formatDateTime(attachment.dateCreated)}
                    </span>
                </div>
            </div>
            <div class="attachment-actions">
                <button class="btn-attachment btn-view" onclick="window.open('${attachment.viewUrl || attachment.fileUrl}', '_blank')" title="Visualizar PDF">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                </button>
                <button class="btn-attachment btn-download" onclick="downloadAttachment('${attachment.downloadUrl || attachment.fileUrl}', '${attachment.fileName}')" title="Baixar PDF">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-15"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                </button>
                <button class="btn-attachment btn-remove" onclick="confirmRemoveAttachment('${attachment.fileId}', '${attachment.fileName}')" title="Remover PDF">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        <line x1="10" y1="11" x2="10" y2="17"/>
                        <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

// Download attachment
function downloadAttachment(fileUrl, fileName) {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Confirm remove attachment
function confirmRemoveAttachment(fileId, fileName) {
    customAlert.confirm(
        `Deseja realmente remover o anexo "${fileName}"?<br><br>⚠️ Esta ação não pode ser desfeita.`,
        () => {
            removeAttachment(fileId, fileName);
        },
        null,
        'Remover Anexo'
    );
}

// Remove attachment
async function removeAttachment(fileId, fileName) {
    if (!currentOccurrence || !fileId) return;

    showLoading('Removendo anexo', 'Excluindo arquivo do Google Drive...');

    try {
        const result = await ipcRenderer.invoke('delete-pdf-attachment', {
            fileId: fileId,
            fileName: fileName,
            numeroGenesis: currentOccurrence.ocorrencia.numeroGenesis
        });

        hideLoading();

        if (result && result.success) {
            customAlert.success(`Anexo "${fileName}" removido com sucesso!`);

            // Recarregar anexos no modal
            const attachmentsList = document.getElementById('attachmentsList');
            if (attachmentsList && currentOccurrence) {
                loadAttachments(currentOccurrence.ocorrencia.numeroGenesis);
            }

            // Limpar cache e atualizar indicador na tabela
            attachmentsCache.delete(currentOccurrence.ocorrencia.numeroGenesis);
            updateAttachmentIndicator(currentOccurrence.ocorrencia.numeroGenesis);
        } else {
            customAlert.error('Erro ao remover anexo: ' + (result?.message || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao remover anexo:', error);
        hideLoading();
        customAlert.error('Erro ao remover anexo: ' + error.message);
    }
}

// Close modal - Otimizado para Performance
function closeModal() {
    // Usar requestAnimationFrame para melhor performance
    requestAnimationFrame(() => {
        viewModal.classList.remove('active');
        currentOccurrence = null;
        isEditMode = false;
    });
}

// Save edit
async function saveEdit() {
    if (!currentOccurrence) return;

    // Guardar o número Genesis original para identificação
    const numeroGenesisOriginal = currentOccurrence.ocorrencia.numeroGenesis;
    const numeroGenesisNovo = document.getElementById('edit-numeroGenesis').value;

    const updatedData = {
        id: currentOccurrence.id,
        numeroGenesisOriginal: numeroGenesisOriginal, // Para identificar a linha no Google Sheets
        ocorrencia: {
            numeroGenesis: numeroGenesisNovo,
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

    console.log('Dados de atualização:', updatedData);
    console.log('Número Genesis Original:', numeroGenesisOriginal);
    console.log('Número Genesis Novo:', numeroGenesisNovo);

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
window.confirmDelete = function (index) {
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
window.openPrintModal = function (index) {
    currentOccurrence = filteredOccurrences[index];
    printOccurrenceId.textContent = currentOccurrence.ocorrencia.numeroGenesis;
    printModal.classList.add('active');
};

// Open attach modal
window.openAttachModal = function (index) {
    console.log('Abrindo modal de anexo para índice:', index);
    currentOccurrence = filteredOccurrences[index];
    console.log('Ocorrência atual:', currentOccurrence);

    // Limpar estado anterior
    if (pdfFileInput) pdfFileInput.value = '';
    if (attachOccurrenceId) attachOccurrenceId.textContent = currentOccurrence.ocorrencia.numeroGenesis;
    if (selectedFileName) selectedFileName.textContent = 'Nenhum arquivo selecionado';
    if (btnUploadPDF) btnUploadPDF.disabled = true;
    
    // Abrir modal
    if (attachModal) {
        attachModal.classList.add('active');
        console.log('Modal de anexo aberto');
        
        // Garantir que o modal permaneça visível
        setTimeout(() => {
            if (!attachModal.classList.contains('active')) {
                console.log('Modal foi fechado inadvertidamente, reabrindo...');
                attachModal.classList.add('active');
            }
        }, 100);
    } else {
        console.error('Modal de anexo não encontrado');
    }
};

// Close print modal
function closePrintModal() {
    requestAnimationFrame(() => {
        printModal.classList.remove('active');
    });
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

// Close attach modal
function closeAttachModal() {
    console.log('Fechando modal de anexo...');
    requestAnimationFrame(() => {
        if (attachModal) {
            attachModal.classList.remove('active');
        }
        if (pdfFileInput) {
            pdfFileInput.value = '';
        }
        if (selectedFileName) {
            selectedFileName.textContent = 'Nenhum arquivo selecionado';
        }
        if (btnUploadPDF) {
            btnUploadPDF.disabled = true;
        }
        console.log('Modal de anexo fechado');
    });
}

// Select PDF file
function selectPDFFile() {
    console.log('Abrindo seletor de arquivo...');
    if (pdfFileInput) {
        pdfFileInput.click();
    } else {
        console.error('Elemento pdfFileInput não encontrado');
    }
}

// Handle PDF file selection
function handlePDFSelection(event) {
    console.log('Arquivo selecionado:', event.target.files);
    
    // Garantir que o modal permaneça aberto
    if (attachModal && !attachModal.classList.contains('active')) {
        console.log('Reabrindo modal de anexo...');
        attachModal.classList.add('active');
    }
    
    const file = event.target.files[0];
    if (file) {
        console.log('Tipo do arquivo:', file.type);
        console.log('Tamanho do arquivo:', file.size);

        if (file.type !== 'application/pdf') {
            customAlert.error('Por favor, selecione apenas arquivos PDF.');
            pdfFileInput.value = '';
            selectedFileName.textContent = 'Nenhum arquivo selecionado';
            btnUploadPDF.disabled = true;
            return;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            customAlert.error('O arquivo deve ter no máximo 10MB.');
            pdfFileInput.value = '';
            selectedFileName.textContent = 'Nenhum arquivo selecionado';
            btnUploadPDF.disabled = true;
            return;
        }

        selectedFileName.textContent = file.name;
        btnUploadPDF.disabled = false;
        console.log('Arquivo válido selecionado:', file.name);
    } else {
        console.log('Nenhum arquivo selecionado - usuário cancelou');
        selectedFileName.textContent = 'Nenhum arquivo selecionado';
        btnUploadPDF.disabled = true;
    }
}

// Upload PDF to Google Drive
async function uploadPDFAttachment() {
    console.log('Iniciando upload do PDF...');
    if (!currentOccurrence || !pdfFileInput.files[0]) {
        console.log('Erro: Ocorrência ou arquivo não encontrado');
        return;
    }

    const file = pdfFileInput.files[0];
    console.log('Arquivo para upload:', file.name, file.size);
    showLoading('Enviando PDF', 'Fazendo upload para o Google Drive...');

    try {
        // Converter arquivo para ArrayBuffer para enviar via IPC
        const arrayBuffer = await file.arrayBuffer();
        const fileData = {
            name: file.name,
            size: file.size,
            type: file.type,
            data: Array.from(new Uint8Array(arrayBuffer))
        };

        console.log('Enviando arquivo via IPC...');
        const result = await ipcRenderer.invoke('upload-pdf-attachment', {
            fileData: fileData,
            occurrence: currentOccurrence,
            fileName: file.name
        });

        hideLoading();
        console.log('Resposta do backend:', result);

        if (result && result.success) {
            // Fechar modal imediatamente
            closeAttachModal();
            
            // Mostrar mensagem de sucesso
            customAlert.success('PDF anexado com sucesso!<br><br><strong>Arquivo:</strong> ' + result.fileName);

            // Recarregar anexos no modal se estiver aberto
            const attachmentsList = document.getElementById('attachmentsList');
            if (attachmentsList && currentOccurrence) {
                loadAttachments(currentOccurrence.ocorrencia.numeroGenesis);
            }

            // Limpar cache e atualizar indicador na tabela
            attachmentsCache.delete(currentOccurrence.ocorrencia.numeroGenesis);
            updateAttachmentIndicator(currentOccurrence.ocorrencia.numeroGenesis);
        } else {
            console.error('Erro no resultado:', result);
            customAlert.error('Erro ao anexar PDF: ' + (result?.message || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao fazer upload do PDF:', error);
        hideLoading();
        customAlert.error('Erro ao anexar PDF: ' + error.message);
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

// Search com debounce para melhor performance
let searchTimeout;
searchInput.addEventListener('input', (e) => {
    // Limpar timeout anterior
    clearTimeout(searchTimeout);

    // Debounce de 300ms para evitar muitas renderizações
    searchTimeout = setTimeout(() => {
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
    }, 300);
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
    // Fechar dropdown do usuário se clicar fora
    if (!userDropdown.contains(e.target) && !userMenuBtn.contains(e.target)) {
        userDropdown.classList.remove('active');
    }
    
    // Não interferir com modais ou file inputs
    if (e.target.type === 'file' || e.target.closest('.modal') || e.target.closest('.upload-zone')) {
        return;
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

// Attach modal events
if (attachModalClose) attachModalClose.addEventListener('click', closeAttachModal);
if (btnCancelAttach) btnCancelAttach.addEventListener('click', closeAttachModal);
// Event listener para seleção de arquivo PDF
if (pdfFileInput) {
    pdfFileInput.addEventListener('change', handlePDFSelection);
    
    // Prevenir que o modal feche quando o file dialog for cancelado
    pdfFileInput.addEventListener('cancel', (e) => {
        console.log('Seleção de arquivo cancelada');
        e.preventDefault();
        e.stopPropagation();
    });
}

if (btnUploadPDF) btnUploadPDF.addEventListener('click', uploadPDFAttachment);

// Adicionar event listener na zona de upload
const uploadZone = document.querySelector('.upload-zone');
if (uploadZone) {
    uploadZone.addEventListener('click', function () {
        console.log('Zona de upload clicada');
        if (pdfFileInput) {
            pdfFileInput.click();
        }
    });
}

// Debug: verificar se os elementos existem
console.log('Elementos do modal de anexo:');
console.log('attachModal:', !!attachModal);
console.log('attachModalClose:', !!attachModalClose);
console.log('btnCancelAttach:', !!btnCancelAttach);
console.log('uploadZone:', !!uploadZone);
console.log('pdfFileInput:', !!pdfFileInput);
console.log('btnUploadPDF:', !!btnUploadPDF);
console.log('selectedFileName:', !!selectedFileName);

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

// Close attach modal on outside click (but not when file dialog is open)
attachModal.addEventListener('click', (e) => {
    if (e.target === attachModal) {
        closeAttachModal();
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
    // Ocorrências Gerais
    createLineChart();
    createPieChartMonth();
    createBarChartDay();

    // Unidade
    createPieChartUnidadePeriodo();
    createPieChartUnidadeMes();
    createBarChartUnidadeDia();

    // Itens
    createPieChartItensPeriodo();
    createPieChartItensMes();
    createBarChartItensDia();
}

// Create pie chart - Occurrences over custom date range or last 30 days
function createLineChart() {
    const ctx = document.getElementById('lineChart');
    if (!ctx) return;

    // Destroy existing chart
    if (lineChart) {
        lineChart.destroy();
    }

    // Determine date range
    let startDate, endDate;
    if (customDateRange) {
        startDate = customDateRange.startDate;
        endDate = customDateRange.endDate;
    } else {
        // Default: last 30 days
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 29);
    }

    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    let labels = [];
    let counts = [];

    // Se período maior que 60 dias, agrupar por mês
    if (daysDiff > 60) {
        const monthCounts = {};

        // Filtrar ocorrências no período
        const filteredOccs = allOccurrences.filter(occ => {
            if (!occ.metadata?.dataRegistro) return false;
            const occDate = new Date(occ.metadata.dataRegistro);
            return occDate >= startDate && occDate <= endDate;
        });

        // Contar por mês
        filteredOccs.forEach(occ => {
            const occDate = new Date(occ.metadata.dataRegistro);
            const monthKey = `${monthNames[occDate.getMonth()]}/${occDate.getFullYear()}`;
            monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
        });

        // Ordenar por data
        const sortedMonths = Object.entries(monthCounts).sort((a, b) => {
            const [monthA, yearA] = a[0].split('/');
            const [monthB, yearB] = b[0].split('/');
            const dateA = new Date(yearA, monthNames.indexOf(monthA));
            const dateB = new Date(yearB, monthNames.indexOf(monthB));
            return dateA - dateB;
        });

        labels = sortedMonths.map(([month]) => month);
        counts = sortedMonths.map(([, count]) => count);
    } else {
        // Período curto: agrupar por dia
        for (let i = 0; i <= daysDiff; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            labels.push(dateStr);

            const count = allOccurrences.filter(occ => {
                if (!occ.metadata?.dataRegistro) return false;
                const occDate = new Date(occ.metadata.dataRegistro);
                return occDate.toDateString() === date.toDateString();
            }).length;
            counts.push(count);
        }
    }

    const colors = ['#279b4d', '#071d49', '#fac709', '#c33', '#00bcd4', '#ff9800', '#9c27b0', '#4caf50', '#f44336', '#2196f3', '#ff5722', '#795548'];

    lineChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: colors.slice(0, labels.length),
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
                    display: false
                },
                tooltip: {
                    backgroundColor: '#071d49',
                    padding: 16,
                    titleFont: {
                        size: 0
                    },
                    bodyFont: {
                        size: 16,
                        weight: 'bold'
                    },
                    bodyColor: '#fff',
                    borderColor: '#fac709',
                    borderWidth: 2,
                    displayColors: false,
                    callbacks: {
                        title: function () {
                            return '';
                        },
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

// Create bar chart - Occurrences by day (last 7 days)
function createBarChartDay() {
    const ctx = document.getElementById('barChartDay');
    if (!ctx) return;

    // Destroy existing chart
    if (barChartDay) {
        barChartDay.destroy();
    }

    // Get last 7 days data
    const last7Days = [];
    const counts = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        last7Days.push(dateStr);

        const count = allOccurrences.filter(occ => {
            if (!occ.metadata?.dataRegistro) return false;
            const occDate = new Date(occ.metadata.dataRegistro);
            return occDate.toDateString() === date.toDateString();
        }).length;
        counts.push(count);
    }

    const total = counts.reduce((a, b) => a + b, 0);

    // Update total display
    const totalElement = document.getElementById('totalDayOccurrences');
    if (totalElement) {
        totalElement.textContent = total;
    }

    barChartDay = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: last7Days,
            datasets: [{
                label: 'Ocorrências',
                data: counts,
                backgroundColor: '#279b4d',
                borderColor: '#279b4d',
                borderWidth: 1,
                borderRadius: 6,
                hoverBackgroundColor: '#1f7d3d'
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
                        color: '#666'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Create pie chart - Occurrences by unit with date filter
function createPieChartUnidadePeriodo() {
    const ctx = document.getElementById('pieChartUnidadePeriodo');
    if (!ctx) return;

    // Destroy existing chart
    if (pieChartUnidadePeriodo) {
        pieChartUnidadePeriodo.destroy();
    }

    // Determine date range
    let startDate, endDate;
    if (customDateRangeUnidade) {
        startDate = customDateRangeUnidade.startDate;
        endDate = customDateRangeUnidade.endDate;
    } else {
        // Default: last 30 days
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 29);
    }

    // Filtrar ocorrências no período
    const filteredOccs = allOccurrences.filter(occ => {
        if (!occ.metadata?.dataRegistro) return false;
        const occDate = new Date(occ.metadata.dataRegistro);
        return occDate >= startDate && occDate <= endDate;
    });

    // Contar por unidade
    const unitCounts = {};
    filteredOccs.forEach(occ => {
        const unit = occ.ocorrencia?.unidade || 'Não especificado';
        unitCounts[unit] = (unitCounts[unit] || 0) + 1;
    });

    // Ordenar por quantidade
    const sortedUnits = Object.entries(unitCounts)
        .sort((a, b) => b[1] - a[1]);

    const labels = sortedUnits.map(([unit]) => unit);
    const counts = sortedUnits.map(([, count]) => count);
    const total = counts.reduce((a, b) => a + b, 0);

    // Update total display
    const totalElement = document.getElementById('totalUnidadePeriodo');
    if (totalElement) {
        totalElement.textContent = total;
    }

    const colors = ['#071d49', '#279b4d', '#fac709', '#c33', '#00bcd4', '#ff9800', '#9c27b0', '#4caf50', '#f44336', '#2196f3', '#ff5722', '#795548'];

    pieChartUnidadePeriodo = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: colors.slice(0, labels.length),
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
                    display: false
                },
                tooltip: {
                    backgroundColor: '#071d49',
                    padding: 16,
                    titleFont: {
                        size: 0
                    },
                    bodyFont: {
                        size: 16,
                        weight: 'bold'
                    },
                    bodyColor: '#fff',
                    borderColor: '#fac709',
                    borderWidth: 2,
                    displayColors: false,
                    callbacks: {
                        title: function () {
                            return '';
                        },
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

// Create pie chart - Item types with date filter
function createPieChartItensPeriodo() {
    const ctx = document.getElementById('pieChartItensPeriodo');
    if (!ctx) return;

    // Destroy existing chart
    if (pieChartItensPeriodo) {
        pieChartItensPeriodo.destroy();
    }

    // Determine date range
    let startDate, endDate;
    if (customDateRangeItens) {
        startDate = customDateRangeItens.startDate;
        endDate = customDateRangeItens.endDate;
    } else {
        // Default: last 30 days
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 29);
    }

    // Filtrar ocorrências no período
    const filteredOccs = allOccurrences.filter(occ => {
        if (!occ.metadata?.dataRegistro) return false;
        const occDate = new Date(occ.metadata.dataRegistro);
        return occDate >= startDate && occDate <= endDate;
    });

    // Contar por tipo de item
    const itemCounts = {};
    filteredOccs.forEach(occ => {
        const item = occ.itemApreendido?.item || 'Não especificado';
        itemCounts[item] = (itemCounts[item] || 0) + 1;
    });

    // Ordenar por quantidade
    const sortedItems = Object.entries(itemCounts)
        .sort((a, b) => b[1] - a[1]);

    const labels = sortedItems.map(([item]) => item);
    const counts = sortedItems.map(([, count]) => count);
    const total = counts.reduce((a, b) => a + b, 0);

    // Update total display
    const totalElement = document.getElementById('totalItensPeriodo');
    if (totalElement) {
        totalElement.textContent = total;
    }

    const colors = ['#fac709', '#279b4d', '#071d49', '#c33', '#00bcd4', '#ff9800', '#9c27b0', '#4caf50', '#f44336', '#2196f3', '#ff5722', '#795548'];

    pieChartItensPeriodo = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: colors.slice(0, labels.length),
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
                    display: false
                },
                tooltip: {
                    backgroundColor: '#071d49',
                    padding: 16,
                    titleFont: {
                        size: 0
                    },
                    bodyFont: {
                        size: 16,
                        weight: 'bold'
                    },
                    bodyColor: '#fff',
                    borderColor: '#fac709',
                    borderWidth: 2,
                    displayColors: false,
                    callbacks: {
                        title: function () {
                            return '';
                        },
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

// Create pie chart - Occurrences by unit by month
function createPieChartUnidadeMes() {
    const ctx = document.getElementById('pieChartUnidadeMes');
    if (!ctx) return;

    if (pieChartUnidadeMes) {
        pieChartUnidadeMes.destroy();
    }

    const unitCounts = {};
    allOccurrences.forEach(occ => {
        const unit = occ.ocorrencia?.unidade || 'Não especificado';
        unitCounts[unit] = (unitCounts[unit] || 0) + 1;
    });

    const sortedUnits = Object.entries(unitCounts).sort((a, b) => b[1] - a[1]);
    const labels = sortedUnits.map(([unit]) => unit);
    const data = sortedUnits.map(([, count]) => count);
    const total = data.reduce((a, b) => a + b, 0);

    const totalElement = document.getElementById('totalUnidadeMes');
    if (totalElement) totalElement.textContent = total;

    const colors = ['#071d49', '#279b4d', '#fac709', '#c33', '#00bcd4', '#ff9800', '#9c27b0', '#4caf50'];

    pieChartUnidadeMes = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: '#fff',
                borderWidth: 2,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#071d49',
                    padding: 16,
                    titleFont: {
                        size: 0
                    },
                    bodyFont: {
                        size: 16,
                        weight: 'bold'
                    },
                    bodyColor: '#fff',
                    borderColor: '#fac709',
                    borderWidth: 2,
                    displayColors: false,
                    callbacks: {
                        title: function () {
                            return '';
                        },
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

// Create bar chart - Occurrences by unit by day (last 7 days)
function createBarChartUnidadeDia() {
    const ctx = document.getElementById('barChartUnidadeDia');
    if (!ctx) return;

    if (barChartUnidadeDia) {
        barChartUnidadeDia.destroy();
    }

    // Filtrar ocorrências dos últimos 7 dias
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const last7DaysOccs = allOccurrences.filter(occ => {
        if (!occ.metadata?.dataRegistro) return false;
        const occDate = new Date(occ.metadata.dataRegistro);
        return occDate >= sevenDaysAgo && occDate <= now;
    });

    // Agrupar por unidade
    const unitCounts = {};
    last7DaysOccs.forEach(occ => {
        const unit = occ.ocorrencia?.unidade || 'Não especificado';
        unitCounts[unit] = (unitCounts[unit] || 0) + 1;
    });

    const sortedUnits = Object.entries(unitCounts).sort((a, b) => b[1] - a[1]);
    const labels = sortedUnits.map(([unit]) => unit);
    const counts = sortedUnits.map(([, count]) => count);
    const total = counts.reduce((a, b) => a + b, 0);

    const totalElement = document.getElementById('totalUnidadeDia');
    if (totalElement) totalElement.textContent = total;

    const colors = ['#071d49', '#279b4d', '#fac709', '#c33', '#00bcd4', '#ff9800', '#9c27b0', '#4caf50'];

    barChartUnidadeDia = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ocorrências',
                data: counts,
                backgroundColor: colors.slice(0, labels.length),
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, color: '#666' }, grid: { color: '#f0f2f5' } },
                x: { ticks: { color: '#666' }, grid: { display: false } }
            }
        }
    });
}

// Create pie chart - Items by month
function createPieChartItensMes() {
    const ctx = document.getElementById('pieChartItensMes');
    if (!ctx) return;

    if (pieChartItensMes) {
        pieChartItensMes.destroy();
    }

    const itemCounts = {};
    allOccurrences.forEach(occ => {
        const item = occ.itemApreendido?.item || 'Não especificado';
        itemCounts[item] = (itemCounts[item] || 0) + 1;
    });

    const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);
    const labels = sortedItems.map(([item]) => item);
    const data = sortedItems.map(([, count]) => count);
    const total = data.reduce((a, b) => a + b, 0);

    const totalElement = document.getElementById('totalItensMes');
    if (totalElement) totalElement.textContent = total;

    const colors = ['#071d49', '#279b4d', '#fac709', '#c33', '#1976d2', '#f57c00', '#7b1fa2', '#00897b', '#00bcd4', '#ff9800'];

    pieChartItensMes = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: '#fff',
                borderWidth: 2,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#071d49',
                    padding: 16,
                    titleFont: {
                        size: 0
                    },
                    bodyFont: {
                        size: 16,
                        weight: 'bold'
                    },
                    bodyColor: '#fff',
                    borderColor: '#fac709',
                    borderWidth: 2,
                    displayColors: false,
                    callbacks: {
                        title: function () {
                            return '';
                        },
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

// Create bar chart - Items by day (last 7 days)
function createBarChartItensDia() {
    const ctx = document.getElementById('barChartItensDia');
    if (!ctx) return;

    if (barChartItensDia) {
        barChartItensDia.destroy();
    }

    // Filtrar ocorrências dos últimos 7 dias
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const last7DaysOccs = allOccurrences.filter(occ => {
        if (!occ.metadata?.dataRegistro) return false;
        const occDate = new Date(occ.metadata.dataRegistro);
        return occDate >= sevenDaysAgo && occDate <= now;
    });

    // Agrupar por tipo de item
    const itemCounts = {};
    last7DaysOccs.forEach(occ => {
        const item = occ.itemApreendido?.item || 'Não especificado';
        itemCounts[item] = (itemCounts[item] || 0) + 1;
    });

    const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);
    const labels = sortedItems.map(([item]) => item);
    const counts = sortedItems.map(([, count]) => count);
    const total = counts.reduce((a, b) => a + b, 0);

    const totalElement = document.getElementById('totalItensDia');
    if (totalElement) totalElement.textContent = total;

    const colors = ['#fac709', '#279b4d', '#071d49', '#c33', '#00bcd4', '#ff9800', '#9c27b0', '#4caf50'];

    barChartItensDia = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ocorrências',
                data: counts,
                backgroundColor: colors.slice(0, labels.length),
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, color: '#666' }, grid: { color: '#f0f2f5' } },
                x: { ticks: { color: '#666' }, grid: { display: false } }
            }
        }
    });
}

// Create pie chart - Occurrences by month
function createPieChartMonth() {
    const ctx = document.getElementById('pieChartMonth');
    if (!ctx) return;

    // Destroy existing chart
    if (pieChartMonth) {
        pieChartMonth.destroy();
    }

    // Count by month
    const monthCounts = {};
    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    // Initialize all months with 0
    monthNames.forEach(month => {
        monthCounts[month] = 0;
    });

    // Count occurrences by month
    allOccurrences.forEach(occ => {
        if (occ.metadata?.dataRegistro) {
            const occDate = new Date(occ.metadata.dataRegistro);
            const monthName = monthNames[occDate.getMonth()];
            monthCounts[monthName]++;
        }
    });

    // Filter out months with 0 occurrences and sort by month order
    const sortedData = monthNames
        .map(month => ({ month, count: monthCounts[month] }))
        .filter(item => item.count > 0);

    const labels = sortedData.map(item => item.month);
    const data = sortedData.map(item => item.count);
    const total = data.reduce((a, b) => a + b, 0);

    // Update total display
    const totalElement = document.getElementById('totalMonthOccurrences');
    if (totalElement) {
        totalElement.textContent = total;
    }

    // Colors for each month
    const colors = [
        '#279b4d', '#071d49', '#fac709', '#c33',
        '#00bcd4', '#ff9800', '#9c27b0', '#4caf50',
        '#f44336', '#2196f3', '#ff5722', '#795548'
    ];

    pieChartMonth = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: '#fff',
                borderWidth: 2,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#071d49',
                    padding: 16,
                    titleFont: {
                        size: 0
                    },
                    bodyFont: {
                        size: 16,
                        weight: 'bold'
                    },
                    bodyColor: '#fff',
                    borderColor: '#fac709',
                    borderWidth: 2,
                    displayColors: false,
                    callbacks: {
                        title: function () {
                            return '';
                        },
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

// ==================== FILTRO DE DATA PERSONALIZADA ====================

// Função para validar data no formato brasileiro
function isValidDateFilter(dateString) {
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

// Função para converter data brasileira para objeto Date
function brDateToDateObj(brDate) {
    const [day, month, year] = brDate.split('/');
    return new Date(year, month - 1, day);
}

// Aplicar máscara de data nos campos de filtro
function applyDateMaskFilter(e) {
    let value = e.target.value.replace(/\D/g, '');

    if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2);
    }
    if (value.length >= 5) {
        value = value.substring(0, 5) + '/' + value.substring(5, 9);
    }

    e.target.value = value;
}

// Event listeners para máscaras de data
if (filterDataInicio) {
    filterDataInicio.addEventListener('input', applyDateMaskFilter);
}

if (filterDataFim) {
    filterDataFim.addEventListener('input', applyDateMaskFilter);
}

// Filtrar gráfico por data personalizada
if (btnFilterChart) {
    btnFilterChart.addEventListener('click', () => {
        const dataInicio = filterDataInicio.value;
        const dataFim = filterDataFim.value;

        if (!dataInicio || !dataFim) {
            customAlert.error('Por favor, preencha ambas as datas');
            return;
        }

        if (!isValidDateFilter(dataInicio)) {
            customAlert.error('Data de início inválida. Use o formato dd/mm/aaaa');
            return;
        }

        if (!isValidDateFilter(dataFim)) {
            customAlert.error('Data de fim inválida. Use o formato dd/mm/aaaa');
            return;
        }

        const startDate = brDateToDateObj(dataInicio);
        const endDate = brDateToDateObj(dataFim);

        if (startDate > endDate) {
            customAlert.error('A data de início deve ser anterior à data de fim');
            return;
        }

        customDateRange = { startDate, endDate };
        createLineChart();
    });
}

// Resetar filtro para últimos 30 dias
if (btnResetFilter) {
    btnResetFilter.addEventListener('click', () => {
        customDateRange = null;
        filterDataInicio.value = '';
        filterDataFim.value = '';
        createLineChart();
    });
}

// ==================== FILTRO DE DATA PARA UNIDADE ====================

// Event listeners para máscaras de data - Unidade
if (filterDataInicioUnidade) {
    filterDataInicioUnidade.addEventListener('input', applyDateMaskFilter);
}

if (filterDataFimUnidade) {
    filterDataFimUnidade.addEventListener('input', applyDateMaskFilter);
}

// Filtrar gráfico de Unidade por data personalizada
if (btnFilterChartUnidade) {
    btnFilterChartUnidade.addEventListener('click', () => {
        const dataInicio = filterDataInicioUnidade.value;
        const dataFim = filterDataFimUnidade.value;

        if (!dataInicio || !dataFim) {
            customAlert.error('Por favor, preencha ambas as datas');
            return;
        }

        if (!isValidDateFilter(dataInicio)) {
            customAlert.error('Data de início inválida. Use o formato dd/mm/aaaa');
            return;
        }

        if (!isValidDateFilter(dataFim)) {
            customAlert.error('Data de fim inválida. Use o formato dd/mm/aaaa');
            return;
        }

        const startDate = brDateToDateObj(dataInicio);
        const endDate = brDateToDateObj(dataFim);

        if (startDate > endDate) {
            customAlert.error('A data de início deve ser anterior à data de fim');
            return;
        }

        customDateRangeUnidade = { startDate, endDate };
        createPieChartUnidade();
    });
}

// Resetar filtro de Unidade
if (btnResetFilterUnidade) {
    btnResetFilterUnidade.addEventListener('click', () => {
        customDateRangeUnidade = null;
        filterDataInicioUnidade.value = '';
        filterDataFimUnidade.value = '';
        createPieChartUnidade();
    });
}

// ==================== FILTRO DE DATA PARA ITENS ====================

// Event listeners para máscaras de data - Itens
if (filterDataInicioItens) {
    filterDataInicioItens.addEventListener('input', applyDateMaskFilter);
}

if (filterDataFimItens) {
    filterDataFimItens.addEventListener('input', applyDateMaskFilter);
}

// Filtrar gráfico de Itens por data personalizada
if (btnFilterChartItens) {
    btnFilterChartItens.addEventListener('click', () => {
        const dataInicio = filterDataInicioItens.value;
        const dataFim = filterDataFimItens.value;

        if (!dataInicio || !dataFim) {
            customAlert.error('Por favor, preencha ambas as datas');
            return;
        }

        if (!isValidDateFilter(dataInicio)) {
            customAlert.error('Data de início inválida. Use o formato dd/mm/aaaa');
            return;
        }

        if (!isValidDateFilter(dataFim)) {
            customAlert.error('Data de fim inválida. Use o formato dd/mm/aaaa');
            return;
        }

        const startDate = brDateToDateObj(dataInicio);
        const endDate = brDateToDateObj(dataFim);

        if (startDate > endDate) {
            customAlert.error('A data de início deve ser anterior à data de fim');
            return;
        }

        customDateRangeItens = { startDate, endDate };
        createPieChartItens();
    });
}

// Resetar filtro de Itens
if (btnResetFilterItens) {
    btnResetFilterItens.addEventListener('click', () => {
        customDateRangeItens = null;
        filterDataInicioItens.value = '';
        filterDataFimItens.value = '';
        createPieChartItens();
    });
}
