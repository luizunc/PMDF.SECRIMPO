"""
Wrapper de autenticação KeyAuth para integração com Electron
Utiliza o arquivo oficial keyauth.py com suporte completo a HWID
"""
import sys
import json
import os
from pathlib import Path

# Carregar variáveis de ambiente
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / '.env'
    load_dotenv(dotenv_path=env_path)
except ImportError:
    print(json.dumps({
        "success": False,
        "message": "Biblioteca python-dotenv não instalada. Execute: pip install -r auth/requirements.txt"
    }))
    sys.exit(1)

# Importar KeyAuth oficial
try:
    from keyauth import api
except ImportError:
    print(json.dumps({
        "success": False,
        "message": "Arquivo keyauth.py não encontrado na pasta auth/"
    }))
    sys.exit(1)

# Configurações do KeyAuth a partir do .env
KEYAUTH_NAME = os.getenv('KEYAUTH_NAME')
KEYAUTH_OWNERID = os.getenv('KEYAUTH_OWNERID')
KEYAUTH_VERSION = os.getenv('KEYAUTH_VERSION', '1.0')

# Validar configurações
if not KEYAUTH_NAME or not KEYAUTH_OWNERID:
    print(json.dumps({
        "success": False,
        "message": "Configure KEYAUTH_NAME e KEYAUTH_OWNERID no arquivo .env"
    }))
    sys.exit(1)

def authenticate(username, password):
    """
    Autentica usuário via KeyAuth com HWID automático
    
    O HWID é capturado automaticamente pelo KeyAuth:
    - Windows: SID do usuário (via win32security)
    - Linux: /etc/machine-id
    - macOS: Serial do hardware (IOPlatformSerialNumber)
    
    Args:
        username (str): Nome de usuário
        password (str): Senha do usuário
        
    Returns:
        dict: Resultado da autenticação com dados do usuário
    """
    try:
        # Inicializar KeyAuth (hash vazio para aplicação Electron)
        keyauthapp = api(
            name=KEYAUTH_NAME,
            ownerid=KEYAUTH_OWNERID,
            version=KEYAUTH_VERSION,
            hash_to_check=""  # Hash vazio - não verificar integridade do executável
        )
        
        # Login com HWID automático
        # O método login() captura o HWID automaticamente via others.get_hwid()
        # e vincula a sessão ao hardware do usuário
        keyauthapp.login(username, password)
        
        # Sucesso - retornar dados completos do usuário
        return {
            "success": True,
            "message": "Autenticação realizada com sucesso",
            "userData": {
                "username": keyauthapp.user_data.username,
                "hwid": keyauthapp.user_data.hwid,
                "ip": keyauthapp.user_data.ip,
                "subscription": keyauthapp.user_data.subscription,
                "subscriptions": keyauthapp.user_data.subscriptions,
                "expires": keyauthapp.user_data.expires,
                "createdate": keyauthapp.user_data.createdate,
                "lastlogin": keyauthapp.user_data.lastlogin
            }
        }
        
    except SystemExit:
        # KeyAuth chama os._exit(1) em caso de erro
        return {
            "success": False,
            "message": "Erro na autenticação. Verifique suas credenciais."
        }
    except Exception as e:
        # Tratar outros erros
        error_message = str(e)
        
        # Mensagens personalizadas para erros comuns
        if "username" in error_message.lower() or "user" in error_message.lower():
            error_message = "Usuário não encontrado"
        elif "password" in error_message.lower():
            error_message = "Senha incorreta"
        elif "subscription" in error_message.lower() or "expired" in error_message.lower():
            error_message = "Assinatura expirada ou inválida"
        elif "banned" in error_message.lower():
            error_message = "Usuário banido do sistema"
        elif "hwid" in error_message.lower():
            error_message = "HWID não autorizado. Entre em contato com o administrador"
        elif "blacklist" in error_message.lower():
            error_message = "Hardware bloqueado. Entre em contato com o administrador"
        elif "invalidver" in error_message.lower():
            error_message = "Versão da aplicação inválida. Atualize o sistema"
        
        return {
            "success": False,
            "message": error_message
        }

def main():
    """Função principal para chamada via Electron"""
    if len(sys.argv) != 3:
        print(json.dumps({
            "success": False,
            "message": "Argumentos inválidos"
        }))
        sys.exit(1)
    
    username = sys.argv[1]
    password = sys.argv[2]
    
    # Realizar autenticação
    result = authenticate(username, password)
    
    # Retornar resultado como JSON
    print(json.dumps(result))
    
    # Exit code baseado no sucesso
    sys.exit(0 if result["success"] else 1)

if __name__ == "__main__":
    main()
