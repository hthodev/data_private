const fs = require('fs');
const path = require('path');
const axios = require('axios');
const readline = require('readline');
const colors = require('colors');
const { HttpsProxyAgent } = require('https-proxy-agent');

class PinEye {
    headers(token = '') {
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
            'Content-Type': 'application/json',
            'Origin': 'https://app.pineye.io',
            'Referer': 'https://app.pineye.io/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    getAxiosConfig(token = '', proxy = '') {
        const config = {
            headers: this.headers(token),
            timeout: 5000,
        };
        if (proxy) {
            const proxyAgent = new HttpsProxyAgent(proxy);
            config.httpsAgent = proxyAgent;
        }
        return config;
    }

    async checkProxyIP(proxy) {
        try {
            const proxyAgent = new HttpsProxyAgent(proxy);
            const response = await axios.get('https://api.ipify.org?format=json', { httpsAgent: proxyAgent });
            if (response.status === 200) {
                return response.data.ip;
            } else {
                throw new Error(`Không thể kiểm tra IP của proxy. Status code: ${response.status}`);
            }
        } catch (error) {
            throw new Error(`Error khi kiểm tra IP của proxy: ${error.message}`);
        }
    }

    async auth(userinfo, proxy) {
        const url = 'https://api2.pineye.io/api/v2/Login';
        const payload = { userinfo };

        try {
            const response = await axios.post(url, payload, this.getAxiosConfig('', proxy));
            return response.data;
        } catch (error) {
            this.log(`Error: ${error.message}`, 'error');
            return null;
        }
    }

    async getProfile(token, proxy) {
        const url = 'https://api2.pineye.io/api/v3/Profile/GetBalance';

        try {
            const response = await axios.get(url, this.getAxiosConfig(token, proxy));
            return response.data;
        } catch (error) {
            this.log(`Error: ${error.message}`, 'error');
            return null;
        }
    }

    async getBoosters(token, proxy) {
        const url = 'https://api2.pineye.io/api/v2/Booster';
        try {
            const response = await axios.get(url, this.getAxiosConfig(token, proxy));
            return response.data;
        } catch (error) {
            this.log(`Lỗi rồi: ${error.message}`, 'error');
            return null;
        }
    }

    async buyBooster(token, boosterId, proxy) {
        const url = `https://api2.pineye.io/api/v2/profile/BuyBooster?boosterId=${boosterId}`;
        try {
            const response = await axios.post(url, {}, this.getAxiosConfig(token, proxy));
            return response.data;
        } catch (error) {
            this.log(`Không thể nâng cấp ${boosterId}: ${error.message}`, 'error');
            return null;
        }
    }

    async manageBoosters(token, balance, proxy) {
        const boostersData = await this.getBoosters(token, proxy);
        if (!boostersData || !boostersData.data) {
            this.log('Không lấy được dữ liệu boosts!', 'error');
            return;
        }

        for (const booster of boostersData.data) {
            while (balance >= booster.cost) {
                const result = await this.buyBooster(token, booster.id, proxy);
                if (result && !result.errors) {
                    this.log(`Nâng cấp ${booster.title} thành công. Balance còn: ${result.data.balance}`, 'success');
                    balance = result.data.balance;
                } else {
                    this.log(`Không thể mua ${booster.title}.`, 'warning');
                    break;
                }
            }
        }
    }

    async tapEnergy(token, energy, proxy) {
        const url = `https://api2.pineye.io/api/v1/Tap?count=${energy}`;
        try {
            const response = await axios.get(url, this.getAxiosConfig(token, proxy));
            if (response.data && !response.data.errors) {
                this.log(`Tap thành công | Balance: ${response.data.data.balance}`, 'custom');
            }
        } catch (error) {
            this.log(`Không thể tap: ${error.message}`, 'error');
        }
    }

    async dailyReward(token, proxy) {
        const url = 'https://api2.pineye.io/api/v1/DailyReward';
        try {
            const response = await axios.get(url, this.getAxiosConfig(token, proxy));
            if (response.data && response.data.data && response.data.data.canClaim) {
                const claimUrl = 'https://api2.pineye.io/api/v1/DailyReward/claim';
                const claimResponse = await axios.post(claimUrl, {}, this.getAxiosConfig(token, proxy));
                if (claimResponse.data && !claimResponse.data.errors) {
                    this.log(`Điểm danh thành công | Balance: ${claimResponse.data.data.balance}`, 'success');
                }
            } else {
                this.log('Hôm nay bạn đã điểm danh rồi!', 'warning');
            }
        } catch (error) {
            this.log(`Không lấy được thông tin điểm danh: ${error.message}`, 'error');
        }
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`[${timestamp}] [*] ${msg}`.green);
                break;
            case 'custom':
                console.log(`[${timestamp}] [*] ${msg}`.magenta);
                break;        
            case 'error':
                console.log(`[${timestamp}] [!] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[${timestamp}] [*] ${msg}`.yellow);
                break;
            default:
                console.log(`[${timestamp}] [*] ${msg}`.blue);
        }
    }

    async Countdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`[${new Date().toLocaleTimeString()}] [*] Chờ ${i} giây để tiếp tục...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('');
    }

    extractFirstName(userinfo) {
        try {
            const decodedData = decodeURIComponent(userinfo);

            const userMatch = decodedData.match(/user=({.*?})/);
            if (userMatch && userMatch[1]) {
                const userObject = JSON.parse(userMatch[1]);

                return userObject.first_name;
            } else {
                this.log('Không lấy được firstname.', 'warning');
                return 'Unknown';
            }
        } catch (error) {
            this.log(`Không lấy được firstname: ${error.message}`, 'error');
            return 'Unknown';
        }
    }

    askQuestion(query) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise(resolve => rl.question(query, ans => {
            rl.close();
            resolve(ans);
        }));
    }

    async checkAndBuyLottery(token, proxy) {
        const url = 'https://api2.pineye.io/api/v1/Lottery';
        try {
            const response = await axios.get(url, this.getAxiosConfig(token, proxy));
            const { ticket } = response.data.data;
            if (!ticket.hasBuyed) {
                const buyTicketUrl = 'https://api2.pineye.io/api/v1/Lottery/BuyTicket';
                const buyResponse = await axios.post(buyTicketUrl, {}, this.getAxiosConfig(token, proxy));
                const { code, balance } = buyResponse.data.data;
                this.log(`Mua thành công vé số ${code} | Balance còn: ${balance}`, 'custom');
            } else {
                this.log(`Bạn đã mua vé số rồi: ${ticket.code}`, 'warning');
            }
        } catch (error) {
            this.log(`Không thể mua vé số: ${error.message}`, 'error');
        }
    }

    async getSocialTasks(token, proxy) {
        const url = 'https://api2.pineye.io/api/v1/Social';
        try {
            const response = await axios.get(url, this.getAxiosConfig(token, proxy));

            return response.data.data.map(task => ({
                id: task.id,
                title: task.title,
                score: task.score,
                isClaimed: task.isClaimed
            }));
        } catch (error) {
            this.log(`Không thể lấy danh sách nhiệm vụ xã hội: ${error.message}`, 'error');
            return [];
        }
    }

    async claimSocialTask(token, socialId, proxy) {
        const url = `https://api2.pineye.io/api/v1/SocialFollower/claim?socialId=${socialId}`;
        try {
            const response = await axios.post(url, {}, this.getAxiosConfig(token, proxy));
            if (response.data && !response.data.errors) {
                this.log(`Làm nhiệm vụ thành công`, 'success');
                return response.data.data;
            } else {
                this.log(`Không thể hoàn thành nhiệm vụ, cần làm tay hoặc chưa đủ điều kiện`, 'error');
                return null;
            }
        } catch (error) {
            this.log(`Không thể hoàn thành nhiệm vụ, cần làm tay hoặc chưa đủ điều kiện`, 'error');
            return null;
        }
    }

    async getPranaGameMarketplace(token, proxy) {
        const url = 'https://api2.pineye.io/api/v1/PranaGame/Marketplace';
        try {
            const response = await axios.get(url, this.getAxiosConfig(token, proxy));
            return response.data.data;
        } catch (error) {
            this.log(`Không thể lấy danh sách thẻ: ${error.message}`, 'error');
            return null;
        }
    }

    async purchasePranaGameCard(token, cardId, level = 1, proxy) {
        const url = `https://api2.pineye.io/api/v1/PranaGame/Purch?cardId=${cardId}&level=${level}`;
        try {
            const response = await axios.post(url, {}, this.getAxiosConfig(token, proxy));
            return response.data;
        } catch (error) {
            return null;
        }
    }

    async managePranaGameCards(token, balance, proxy) {
        const marketplaceData = await this.getPranaGameMarketplace(token, proxy);
        if (!marketplaceData) return;

        const configPath = path.join(__dirname, 'config.json');
        let maxCost = 1000000;
        try {
            if (fs.existsSync(configPath)) {
                const configData = fs.readFileSync(configPath, 'utf8');
                const config = JSON.parse(configData);
                if (config.maxCost) {
                    maxCost = config.maxCost;
                }
            } else {
                fs.writeFileSync(configPath, JSON.stringify({ maxCost: 1000000 }, null, 2), 'utf8');
            }
        } catch (error) {
            this.log(`Không thể đọc file config.json: ${error.message}`, 'error');
        }

        let allCards = [];
        for (const category of marketplaceData.categories) {
            for (const collection of category.collections) {
                for (const card of collection.cards) {
                    allCards.push({
                        ...card,
                        categoryId: category.id,
                        collectionId: collection.id
                    });
                }
            }
        }

        allCards.sort((a, b) => b.profit - a.profit);

        for (const card of allCards) {
            if (balance >= card.cost && card.cost <= maxCost && !card.isCompleted) {
                const purchaseResult = await this.purchasePranaGameCard(token, card.id, 1, proxy);
                if (purchaseResult && purchaseResult.data && purchaseResult.data.isSuccess) {
                    balance = purchaseResult.data.balance;
                    this.log(`Mua thẻ "${card.title}" thành công | Profit: ${card.profit} | Balance còn: ${balance}`, 'success');
                }
            }
        }
    }

    async main() {
        const dataFile = path.join(__dirname, 'data.txt');
        const userData = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        const proxyFile = path.join(__dirname, 'proxy.txt');
        const proxyData = fs.readFileSync(proxyFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        const nangcapturbo = await this.askQuestion('Bạn có muốn nâng cấp boosters không? (y/n): ');
        const hoiturbo = nangcapturbo.toLowerCase() === 'y';

        const muaveso = await this.askQuestion('Bạn có muốn mua lottery không? (y/n): ');
        const hoiveso = muaveso.toLowerCase() === 'y';

        const muaPranaCards = await this.askQuestion('Bạn có muốn mua Thẻ Prana không? (y/n): ');
        const hoiPranaCards = muaPranaCards.toLowerCase() === 'y';

        this.log(`Tool được share tại kênh telegram Dân Cày Airdrop!`, 'custom');

        while (true) {
            for (let i = 0; i < userData.length; i++) {
                const userinfo = userData[i];
                const proxy = proxyData[i];
                const first_name = this.extractFirstName(userinfo);

                try {
                    const ip = await this.checkProxyIP(proxy);
                    console.log(`========== Tài khoản ${i + 1} | ${first_name} | IP: ${ip} ==========`.green);
                } catch (error) {
                    this.log(`Proxy lỗi: ${error.message}`, 'error');
                    continue;
                }

                try {
                    const apiResponse = await this.auth(userinfo, proxy);
                    if (apiResponse && apiResponse.data && apiResponse.data.token) {
                        const token = apiResponse.data.token;
                        const profileResponse = await this.getProfile(token, proxy);
                        if (profileResponse && profileResponse.data) {
                            let { totalBalance, level, earnPerTap } = profileResponse.data.profile;
                            const { maxEnergy, currentEnergy } = profileResponse.data.energy;

                            this.log(`Balance: ${totalBalance}`, 'success');
                            this.log(`Lv: ${level}`, 'success');
                            this.log(`Earn Per Tap: ${earnPerTap}`, 'success');
                            this.log(`Năng lượng: ${currentEnergy} / ${maxEnergy}`, 'success');

                            if (currentEnergy > 0) {
                                await this.tapEnergy(token, currentEnergy, proxy);
                                const updatedProfile = await this.getProfile(token, proxy);
                                if (updatedProfile && updatedProfile.data) {
                                    totalBalance = updatedProfile.data.profile.totalBalance;
                                }
                            }

                            await this.dailyReward(token, proxy);
                            if (hoiturbo) {
                                await this.manageBoosters(token, totalBalance, proxy);
                            }
                            if (hoiveso) {
                                await this.checkAndBuyLottery(token, proxy);
                            }

                            if (hoiPranaCards) {
                                await this.managePranaGameCards(token, totalBalance, proxy);
                            }

                            const socialTasks = await this.getSocialTasks(token, proxy);
                            const unclaimedTasks = socialTasks.filter(task => !task.isClaimed);
                            for (const task of unclaimedTasks) {
                                this.log(`Nhận thưởng cho nhiệm vụ "${task.title}" (${task.score} điểm)`, 'info');
                                await this.claimSocialTask(token, task.id, proxy);
                            }

                        } else {
                            this.log(`Không lấy được dữ liệu: ${profileResponse ? profileResponse.errors : 'No response data'}`, 'error');
                        }
                    } else {
                        this.log(`Đăng nhập thất bại: ${apiResponse ? apiResponse.errors : 'No response data'}`, 'error');
                    }
                } catch (error) {
                    this.log(`Lỗi khi xử lý tài khoản: ${error.message}`, 'error');
                    continue;
                }
            }
            await this.Countdown(60);
        }
    }
}

if (require.main === module) {
    const pineye = new PinEye();
    pineye.main().catch(err => {
        console.error(err.toString().red);
        process.exit(1);
    });
}