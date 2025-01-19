import fetch from 'node-fetch';
import readline from 'readline';
import fs from 'fs';
import { logger } from './utils/logger.js';
import { banner } from './utils/banner.js';
import Mailjs from '@cemalgnlts/mailjs';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => {
    return new Promise((resolve) => rl.question(query, resolve));
};

const registerUser = async (name, email, password, inviteCode) => {
    try {
        const registrationPayload = { name, username: email, password, inviteCode };
        const registerResponse = await fetch('https://api.openloop.so/users/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(registrationPayload),
        });

        if (!registerResponse.ok) {
            logger(`Registration failed! Status: ${registerResponse.status}`, 'error');
        }

        const registerData = await registerResponse.json();
        logger('Registration:', 'success', registerData.message);

        await loginUser(email, password);
    } catch (error) {
        logger('Error during registration:', 'error', error.message);
    }
};

const loginUser = async (email, password) => {
    try {
        const loginPayload = { username: email, password };

        const loginResponse = await fetch('https://api.openloop.so/users/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(loginPayload),
        });

        if (!loginResponse.ok) {
            throw new Error(`Login failed! Status: ${loginResponse.status}`);
        }

        const loginData = await loginResponse.json();
        logger('Login successful get token:', 'success', loginData.data.accessToken);

        const accessToken = loginData.data.accessToken;

        fs.appendFileSync('token.txt', accessToken + '\n', 'utf8');
        logger('Access token saved to token.txt');
    } catch (error) {
        logger('Error during login:', 'error', error.message);
    }
};

const mailjs = new Mailjs();

// Main Function
async function manageMailAndRegister() {
    try {
        logger(banner, 'debug');

        const input = await askQuestion('How many reff to create: ');
        const accountCount = parseInt(input, 10);
        if (isNaN(accountCount) || accountCount <= 0) throw new Error('Invalid account count.');

        const ref = await askQuestion('Use my referral code: (y/N): ');
        const referralCode = ref.toLowerCase() === 'n'
            ? await askQuestion('Enter referral code: ')
            : 'ol2d3a6bea';

        logger(`Register Using Referral code: ${referralCode}`, 'info');
        const accountStr = 
`leena.nori818407@motesh.com,Huutho06.vn
aradhana.chaudhari80173@fosaga.com,Huutho06.vn
rachana.rama251288@motesh.com,Huutho06.vn
abhimanyu.dayal773541@givima.com,Huutho06.vn
nachiket.krishnan383735@fosaga.com,Huutho06.vn
bhanumati.munshi200902@mobesu.com,Huutho06.vn
george.lall391994@givima.com,Huutho06.vn
jhalak.konda517470@fosaga.com,Huutho06.vn
bhavika.deep966722@gutade.com,Huutho06.vn
kashvi.nigam94160@motesh.com,Huutho06.vn
kavya.mammen160963@motesh.com,Huutho06.vn
idika.sarma959930@givima.com,Huutho06.vn
pavani.bala200742@pogite.com,Huutho06.vn
bhavna.rajagopalan362683@temipo.com,Huutho06.vn
guneet.deo419843@gutade.com,Huutho06.vn
netra.mane997780@fadoso.com,Huutho06.vn
kashvi.srinivasan194616@pogite.com,Huutho06.vn
naveen.kala572422@pogite.com,Huutho06.vn
krishna.ravel862476@pogite.com,Huutho06.vn
rachana.dhar248116@fosaga.com,Huutho06.vn
prisha.shenoy828794@temipo.com,Huutho06.vn
kiaan.dash314566@mobesu.com,Huutho06.vn
omya.nayar125558@gutade.com,Huutho06.vn
anya.gokhale863147@givima.com,Huutho06.vn
caleb.puri337222@givima.com,Huutho06.vn
bhavna.dhar464028@pogite.com,Huutho06.vn
nicholas.kothari565645@fozina.com,Huutho06.vn
caleb.pandey164563@fadoso.com,Huutho06.vn
nicholas.sekhon550567@motesh.com,Huutho06.vn
chasmum.iyer422484@fozina.com,Huutho06.vn`

        const accounts = accountStr.split('\n')
        let i = 0;
        // for (let i = 0; i < accounts.length; i++) {
        for (const account of accounts) {
            try {
                // const account = await mailjs.createOneAccount();
                const [email, password] = account.split(',')
                // const email = account.data.username;
                // const password = account.data.password;
                const name = email;
                if (email === undefined) {
                    i--;
                    continue;
                }
                logger(`Creating account #${i + 1} - Email: ${email}`, 'debug');

                await registerUser(name, email, password, referralCode);

                fs.appendFileSync('accounts.txt', `Email: ${email}, Password: ${password}` + '\n', 'utf8');
                await new Promise(resolve => setTimeout(resolve, 1000)); 
            } catch (error) {
                logger(`Error with account #${i + 1}: ${error.message}`, 'error');
                await new Promise(resolve => setTimeout(resolve, 1000)); 
            }
            i++
        }
    } catch (error) {
        logger(`Error: ${error.message}`, 'error');
    } finally {
        rl.close();
    }
}

manageMailAndRegister();
