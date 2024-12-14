import requests
import json
import time

# Function to read tokens from data.txt
def read_tokens(filename):
    with open(filename, 'r') as f:
        tokens = f.read().strip().splitlines()
    return tokens

# Function to display countdown
def display_countdown(seconds):
    for i in range(seconds, 0, -1):
        print(f"\rWait {i} seconds...", end="", flush=True)
        time.sleep(1)
    print("\n")

# Function to validate daily code
def validate_daily_code(token, code, account_number):
    headers = {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
        'authorization': f'Bearer {token}',
        'content-type': 'application/json',
        'sec-ch-ua': '"Chromium";v="111", "Not(A:Brand";v="8"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site'
    }

    url = 'https://api.thevertus.app/codes/validate'
    payload = {"code": code}

    try:
        response = requests.post(url, headers=headers, json=payload)
        response_data = response.json()

        if response.status_code == 201 and not response_data.get("isValid", True):
            print(f"\033[93mAccount {account_number} already guessed the correct code today.\033[0m")
        elif response.status_code in [200, 201]:
            print(f'\033[92mDaily Code validated successfully!\033[0m')
        else:
            print(f'\033[91mUnexpected response: HTTP {response.status_code} - {response.text}\033[0m')
    except requests.exceptions.RequestException as e:
        print(f'\033[91mConnection error during Daily Code validation: {e}\033[0m')

# Function to claim daily bonus
def claim_daily_bonus(token):
    headers = {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
        'authorization': f'Bearer {token}',
        'content-type': 'application/json',
        'sec-ch-ua': '"Chromium";v="111", "Not(A:Brand";v="8"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site'
    }
    
    url = 'https://api.thevertus.app/users/claim-daily'
    payload = {}

    try:
        response = requests.post(url, headers=headers, json=payload)
        if response.status_code == 201:
            print(f'\033[92mDaily Bonus claimed successfully.\033[0m')
        elif response.status_code == 409:
            print(f'\033[93mDaily Bonus already claimed.\033[0m')
        else:
            print(f'\033[91mError claiming Daily Bonus: HTTP {response.status_code} - {response.text}\033[0m')
    except requests.exceptions.RequestException as e:
        print(f'\033[91mConnection error claiming Daily Bonus: {e}\033[0m')

# Main function to claim tokens for each account
def claim_tokens():
    # Ask if the user wants to claim the daily code and save the answer
    claim_daily_code = input("\033[96mDo you want to claim daily code? (Y/N): \033[0m").strip().lower()
    code = None
    if claim_daily_code == 'y':
        code = input("\033[96mEnter your Daily Code: \033[0m").strip()

    while True:  # Infinite loop for running the script repeatedly
        tokens = read_tokens('data.txt')  # Read tokens from file

        print(f"\033[1;94mTotal number of accounts: {len(tokens)}\033[0m")
        
        for index, token in enumerate(tokens, start=1):
            print(f'\033[96mProcessing Account {index}\033[0m')
            
            # Validate the daily code for the current account, if opted
            if code:
                validate_daily_code(token, code, index)
            
            # Claim the daily bonus for the current account
            claim_daily_bonus(token)

            # Claim tokens for the account
            headers = {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.9',
                'authorization': f'Bearer {token}',
                'content-type': 'application/json',
                'sec-ch-ua': '"Chromium";v="111", "Not(A:Brand";v="8"',
                'sec-ch-ua-mobile': '?1',
                'sec-ch-ua-platform': '"Android"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site'
            }
            
            url = 'https://api.thevertus.app/game-service/collect'
            payload = {}

            try:
                response = requests.post(url, headers=headers, json=payload)
                if response.status_code == 201:
                    data = json.loads(response.text)
                    new_balance = data.get('newBalance', 0)
                    balance = float(new_balance) / 1e18
                    print(f'\033[1;95mVERT Balance: {balance}\033[0m')
                    print(f'\033[92mVERT Claimed Successfully.\033[0m')
                else:
                    print(f'\033[91mError claiming tokens: HTTP {response.status_code} - {response.text}\033[0m')
            except requests.exceptions.RequestException as e:
                print(f'\033[91mConnection error claiming tokens: {e}\033[0m')

            # Display countdown before processing the next account
            if index < len(tokens):
                display_countdown(5)  # Wait for 5 seconds before processing next account

        print("\nWaiting before claiming tokens again...\n")
        display_countdown(21600)  # Wait for 6 hours (21600 seconds) before repeating

# Start claiming tokens
claim_tokens()
