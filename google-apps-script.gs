function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Pegar todos os dados a partir da linha 3, coluna A
    const lastRow = sheet.getLastRow();
    
    if (lastRow < 3) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        occurrences: []
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const dataRange = sheet.getRange(3, 1, lastRow - 2, 20); // A3 até T (20 colunas a partir da coluna A)
    const values = dataRange.getValues();
    
    const occurrences = values.map(row => ({
      logRegistro: row[0],
      numeroGenesis: row[1],
      unidade: row[2],
      dataApreensao: row[3],
      leiInfrigida: row[4],
      artigo: row[5],
      especie: row[6],
      item: row[7],
      quantidade: row[8],
      unidadeMedida: row[9],
      descricaoItem: row[10],
      nomeProprietario: row[11],
      dataNascimento: row[12],
      tipoDocumento: row[13],
      numeroDocumento: row[14],
      nomePolicial: row[15],
      matricula: row[16],
      graduacao: row[17],
      unidadePolicial: row[18],
      registradoPor: row[19]
    }));
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      occurrences: occurrences
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);
    
    // Se for uma ação de atualização
    if (data.action === 'update') {
      // Usar numeroGenesisOriginal para buscar a linha (número antes da edição)
      // Se não existir, usar numeroGenesis (caso não tenha sido editado)
      const numeroParaBusca = data.numeroGenesisOriginal || data.numeroGenesis;
      const numeroGenesisNovo = data.numeroGenesis;
      const lastRow = sheet.getLastRow();
      
      // Log para debug
      Logger.log('Buscando por número Genesis: ' + numeroParaBusca);
      Logger.log('Novo número Genesis: ' + numeroGenesisNovo);
      
      // Procurar a linha com o número Genesis correspondente (coluna B = índice 2)
      for (let i = 3; i <= lastRow; i++) {
        const valorCelula = sheet.getRange(i, 2).getValue();
        if (valorCelula == numeroParaBusca) {
          Logger.log('Linha encontrada: ' + i);
          
          // Atualizar a linha encontrada (a partir da coluna A = índice 1)
          sheet.getRange(i, 1, 1, 20).setValues([[
            data.timestamp,
            numeroGenesisNovo,  // Usar o novo número Genesis
            data.unidade,
            data.dataApreensao,
            data.leiInfrigida,
            data.artigo,
            data.especie,
            data.item,
            data.quantidade,
            data.unidadeMedida,
            data.descricaoItem,
            data.nomeProprietario,
            data.dataNascimento,
            data.tipoDocumento,
            data.numeroDocumento,
            data.nomePolicial,
            data.matricula,
            data.graduacao,
            data.unidadePolicial,
            data.registradoPor
          ]]);
          
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: 'Ocorrência atualizada com sucesso'
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      
      Logger.log('Ocorrência não encontrada. Número buscado: ' + numeroParaBusca);
      
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Ocorrência não encontrada'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Se for uma ação de exclusão
    if (data.action === 'delete') {
      const numeroGenesis = data.numeroGenesis;
      const lastRow = sheet.getLastRow();
      
      // Procurar a linha com o número Genesis correspondente (coluna B = índice 2)
      for (let i = 3; i <= lastRow; i++) {
        if (sheet.getRange(i, 2).getValue() == numeroGenesis) {
          // Deletar a linha encontrada
          sheet.deleteRow(i);
          
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: 'Ocorrência excluída com sucesso'
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Ocorrência não encontrada'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Inserção normal (adicionar nova linha)
    if (data.values && Array.isArray(data.values)) {
      // Encontrar a próxima linha vazia a partir da linha 3
      const lastRow = sheet.getLastRow();
      const nextRow = Math.max(3, lastRow + 1);
      
      // Inserir dados a partir da coluna A (1ª coluna)
      sheet.getRange(nextRow, 1, 1, data.values.length).setValues([data.values]);
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Dados inseridos com sucesso'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Formato de dados inválido'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
