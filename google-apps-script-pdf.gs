// ===== CONFIGURAÇÕES =====
const DRIVE_FOLDER_ID = '12WsFP-8PUakeNpC7lW9ZWbIDqf6nwdT2'; // ID da pasta principal no Google Drive

// ===== FUNÇÃO PRINCIPAL =====
function doPost(e) {
  try {
    console.log('=== RECEBENDO REQUISIÇÃO POST ===');
    console.log('Dados recebidos:', e.postData);
    
    if (!e.postData || !e.postData.contents) {
      return createResponse(false, 'Dados não encontrados na requisição');
    }
    
    const data = JSON.parse(e.postData.contents);
    console.log('Dados parseados:', data);
    
    switch (data.action) {
      case 'upload':
        return uploadPDF(data);
      case 'list':
        return listFiles(data);
      case 'delete':
        return deleteFile(data);
      default:
        return createResponse(false, 'Ação não reconhecida: ' + data.action);
    }
  } catch (error) {
    console.error('Erro no doPost:', error);
    return createResponse(false, 'Erro no servidor: ' + error.toString());
  }
}

function doGet(e) {
  try {
    console.log('=== RECEBENDO REQUISIÇÃO GET ===');
    console.log('Parâmetros:', e.parameter);
    
    // Teste de conexão
    if (e.parameter.test === 'connection') {
      return testConnection();
    }
    
    const numeroGenesis = e.parameter.numeroGenesis;
    
    if (numeroGenesis) {
      return listFiles({ numeroGenesis: numeroGenesis });
    }
    
    // Se não há parâmetros, retornar informações do script
    return createResponse(true, 'Google Apps Script PDF Manager está funcionando!', {
      endpoints: {
        test: '?test=connection',
        list: '?numeroGenesis=123456'
      },
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro no doGet:', error);
    return createResponse(false, 'Erro no servidor: ' + error.toString());
  }
}

// ===== UPLOAD DE PDF =====
function uploadPDF(data) {
  try {
    let { numeroGenesis, unidade, fileName, fileContent } = data;
    
    // Validar se é PDF
    if (!fileName.toLowerCase().endsWith('.pdf')) {
      throw new Error('Apenas arquivos PDF são permitidos');
    }
    
    // Validar tamanho (50MB máximo)
    const maxSize = 50 * 1024 * 1024; // 50MB em bytes
    if (fileContent.length > maxSize * 1.33) { // Base64 é ~33% maior
      throw new Error('Arquivo muito grande. Máximo 50MB');
    }
    
    // Decodificar arquivo base64
    const blob = Utilities.newBlob(
      Utilities.base64Decode(fileContent),
      'application/pdf',
      fileName
    );
    
    // Criar/encontrar pasta da ocorrência
    const occurrenceFolder = createOccurrenceFolder(numeroGenesis, unidade);
    
    // Verificar se arquivo já existe
    const existingFiles = occurrenceFolder.getFilesByName(fileName);
    if (existingFiles.hasNext()) {
      // Renomear arquivo com timestamp
      const timestamp = new Date().getTime();
      const nameWithoutExt = fileName.replace('.pdf', '');
      fileName = `${nameWithoutExt}_${timestamp}.pdf`;
      blob.setName(fileName);
    }
    
    // Upload do arquivo
    const file = occurrenceFolder.createFile(blob);
    
    // Configurar permissões (visualização pública)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return createResponse(true, 'PDF enviado com sucesso', {
      fileId: file.getId(),
      fileName: file.getName(),
      fileUrl: file.getUrl(),
      downloadUrl: `https://drive.google.com/uc?id=${file.getId()}`,
      viewUrl: `https://drive.google.com/file/d/${file.getId()}/view`,
      size: file.getSize(),
      dateCreated: file.getDateCreated().toISOString(),
      folderId: occurrenceFolder.getId()
    });
    
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    return createResponse(false, error.toString());
  }
}

// ===== LISTAR ARQUIVOS =====
function listFiles(data) {
  try {
    const { numeroGenesis } = data;
    
    // Encontrar pasta da ocorrência
    const occurrenceFolder = findOccurrenceFolder(numeroGenesis);
    if (!occurrenceFolder) {
      return createResponse(true, 'Pasta não encontrada', { files: [] });
    }
    
    // Listar todos os PDFs na pasta
    const files = [];
    const fileIterator = occurrenceFolder.getFiles();
    
    while (fileIterator.hasNext()) {
      const file = fileIterator.next();
      
      // Apenas PDFs
      if (file.getName().toLowerCase().endsWith('.pdf')) {
        files.push({
          fileId: file.getId(),
          fileName: file.getName(),
          fileUrl: file.getUrl(),
          downloadUrl: `https://drive.google.com/uc?id=${file.getId()}`,
          viewUrl: `https://drive.google.com/file/d/${file.getId()}/view`,
          size: file.getSize(),
          dateCreated: file.getDateCreated().toISOString(),
          dateModified: file.getLastUpdated().toISOString()
        });
      }
    }
    
    return createResponse(true, `${files.length} arquivos encontrados`, {
      files: files,
      folderId: occurrenceFolder.getId(),
      folderUrl: occurrenceFolder.getUrl()
    });
    
  } catch (error) {
    console.error('Erro ao listar arquivos:', error);
    return createResponse(false, error.toString());
  }
}

// ===== DELETAR ARQUIVO =====
function deleteFile(data) {
  try {
    const { fileId } = data;
    const file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
    
    return createResponse(true, 'Arquivo excluído com sucesso');
  } catch (error) {
    console.error('Erro ao deletar arquivo:', error);
    return createResponse(false, error.toString());
  }
}

// ===== FUNÇÕES AUXILIARES =====
function createOccurrenceFolder(numeroGenesis, unidade) {
  try {
    const mainFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    
    // Criar estrutura: Ano > Mês > Unidade > Ocorrência
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const monthName = getMonthName(now.getMonth());
    
    // Pasta do ano
    let yearFolder = getOrCreateFolder(mainFolder, year);
    
    // Pasta do mês
    let monthFolder = getOrCreateFolder(yearFolder, `${month}-${monthName}`);
    
    // Pasta da unidade
    let unitFolder = getOrCreateFolder(monthFolder, unidade);
    
    // Pasta da ocorrência
    let occurrenceFolder = getOrCreateFolder(unitFolder, `Genesis_${numeroGenesis}`);
    
    return occurrenceFolder;
  } catch (error) {
    console.error('Erro ao criar pasta:', error);
    throw error;
  }
}

function getOrCreateFolder(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return parentFolder.createFolder(folderName);
  }
}

function findOccurrenceFolder(numeroGenesis) {
  try {
    const mainFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    
    // Buscar recursivamente por pastas com o nome da ocorrência
    return searchFolderRecursive(mainFolder, `Genesis_${numeroGenesis}`);
  } catch (error) {
    console.error('Erro ao encontrar pasta:', error);
    return null;
  }
}

function searchFolderRecursive(parentFolder, targetName) {
  // Buscar na pasta atual
  const folders = parentFolder.getFoldersByName(targetName);
  if (folders.hasNext()) {
    return folders.next();
  }
  
  // Buscar nas subpastas
  const subFolders = parentFolder.getFolders();
  while (subFolders.hasNext()) {
    const subFolder = subFolders.next();
    const result = searchFolderRecursive(subFolder, targetName);
    if (result) {
      return result;
    }
  }
  
  return null;
}

function getMonthName(monthIndex) {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return months[monthIndex];
}

function createResponse(success, message, data = null) {
  const response = {
    success: success,
    message: message,
    timestamp: new Date().toISOString()
  };
  
  if (data) {
    Object.assign(response, data);
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== FUNÇÕES DE TESTE =====
function testConnection() {
  // Função simples para testar se o script está funcionando
  return createResponse(true, 'Google Apps Script está funcionando!', {
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
}

function testUpload() {
  // Função para testar upload (use apenas para desenvolvimento)
  const testData = {
    action: 'upload',
    numeroGenesis: '123456',
    unidade: '8º BPM',
    fileName: 'teste.pdf',
    fileContent: 'JVBERi0xLjQKJdPr6eEKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPD4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovUmVzb3VyY2VzIDw8Ci9Gb250IDw8Ci9GMSA0IDAgUgo+Pgo+PgovQ29udGVudHMgNSAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iago1IDAgb2JqCjw8Ci9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCi9GMSA4IFRmCjEwMCA3MDAgVGQKKEhlbGxvIFdvcmxkKSBUagpFVApzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDI0NSAwMDAwMCBuIAowMDAwMDAwMzIyIDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNgovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNDE0CiUlRU9G' // Base64 de um PDF mínimo
  };
  
  return uploadPDF(testData);
}

function testList() {
  // Função para testar listagem
  const testData = {
    numeroGenesis: '123456'
  };
  
  return listFiles(testData);
}

function createSampleStructure() {
  // Função para criar estrutura de exemplo
  try {
    const mainFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    
    // Criar estrutura de exemplo
    const year2025 = getOrCreateFolder(mainFolder, '2025');
    const jan2025 = getOrCreateFolder(year2025, '01-Janeiro');
    const bpm8 = getOrCreateFolder(jan2025, '8º BPM');
    const genesis123 = getOrCreateFolder(bpm8, 'Genesis_123456');
    
    console.log('Estrutura de exemplo criada com sucesso!');
    console.log('Pasta da ocorrência:', genesis123.getUrl());
    
    return createResponse(true, 'Estrutura criada com sucesso', {
      folderUrl: genesis123.getUrl(),
      folderId: genesis123.getId()
    });
  } catch (error) {
    console.error('Erro ao criar estrutura:', error);
    return createResponse(false, error.toString());
  }
}

// ===== FUNÇÃO PARA LIMPAR PASTAS VAZIAS =====
function cleanEmptyFolders() {
  try {
    const mainFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    cleanEmptyFoldersRecursive(mainFolder);
    
    return createResponse(true, 'Limpeza de pastas vazias concluída');
  } catch (error) {
    console.error('Erro na limpeza:', error);
    return createResponse(false, error.toString());
  }
}

function cleanEmptyFoldersRecursive(parentFolder) {
  const subFolders = parentFolder.getFolders();
  const foldersToDelete = [];
  
  while (subFolders.hasNext()) {
    const folder = subFolders.next();
    
    // Limpar subpastas primeiro
    cleanEmptyFoldersRecursive(folder);
    
    // Verificar se a pasta está vazia
    const hasFiles = folder.getFiles().hasNext();
    const hasSubFolders = folder.getFolders().hasNext();
    
    if (!hasFiles && !hasSubFolders) {
      foldersToDelete.push(folder);
    }
  }
  
  // Deletar pastas vazias
  foldersToDelete.forEach(folder => {
    console.log('Deletando pasta vazia:', folder.getName());
    folder.setTrashed(true);
  });
}