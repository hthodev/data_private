const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');

class YuligoAPIClient {
    constructor() {
        this.baseHeaders = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "Origin": "https://yuligo.yuliverse.com",
            "Referer": "https://yuligo.yuliverse.com/",
            "Sec-Ch-Ua": '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "cross-site",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        };
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`[${timestamp}] [✓] ${msg}`.green);
                break;
            case 'custom':
                console.log(`[${timestamp}] [*] ${msg}`.magenta);
                break;        
            case 'error':
                console.log(`[${timestamp}] [✗] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[${timestamp}] [!] ${msg}`.yellow);
                break;
            default:
                console.log(`[${timestamp}] [ℹ] ${msg}`.blue);
        }
    }

    async countdown(seconds) {
        for (let i = seconds; i > 0; i--) {
            const timestamp = new Date().toLocaleTimeString();
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`[${timestamp}] [*] Chờ ${i} giây để tiếp tục...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);
    }

    async checkProxyIP(proxy) {
        try {
            const proxyAgent = new HttpsProxyAgent(proxy);
            const response = await axios.get('https://api.ipify.org?format=json', {
                httpsAgent: proxyAgent,
                timeout: 5000 
            });
            if (response.status === 200 && response.data && response.data.ip) {
                return response.data.ip;
            } else {
                throw new Error(`Không thể kiểm tra IP của proxy. Status code: ${response.status}`);
            }
        } catch (error) {
            throw new Error(`Error khi kiểm tra IP của proxy: ${error.message}`);
        }
    }

    async login(initData, agent) {
        const url = "https://yuligo.yuliverse.io/api/g/v1/login";
        
        try {
            const headers = {
                ...this.baseHeaders,
                "Content-Type": "application/json"
            };

            const payload = {
                init_data: initData
            };

            const response = await axios.post(url, payload, { headers, httpsAgent: agent });

            if (response.status === 201) {
                const cookieId = response.headers['x-cookie-id'];
                
                if (cookieId) {
                    this.log(`Login thành công. Cookie ID: ${cookieId.yellow}`, 'success');
                    return cookieId;
                } else {
                    this.log('Không tìm thấy Cookie ID trong phản hồi', 'error');
                    return null;
                }
            } else {
                this.log(`Đăng nhập không thành công: ${response.status}`, 'error');
                return null;
            }
        } catch (error) {
            this.log(`Lỗi đăng nhập: ${error.message}`, 'error');
            return null;
        }
    }

    async fetchUserProfile(cookieId, agent) {
        const url = "https://yuligo.yuliverse.io/api/g/v1/profile";
        
        try {
            const headers = {
                ...this.baseHeaders,
                "X-Cookie-Id": cookieId
            };

            const response = await axios.get(url, { headers, httpsAgent: agent });

            if (response.status === 200) {
                const profileData = response.data;
                
                this.log(`Username: ${profileData.data.username.green}`, 'info');
                this.log(`Token GO: ${profileData.data.wallet_info.token_go.magenta}`, 'custom');
                this.log(`ART: ${profileData.data.wallet_info.art.cyan}`, 'custom');
                
                return profileData;
            } else {
                this.log(`Không thể lấy thông tin profile: ${response.status}`, 'error');
                return null;
            }
        } catch (error) {
            this.log(`Lỗi khi gọi API: ${error.message}`, 'error');
            return null;
        }
    }

    async claimRewards(cookieId, agent) {
        const url = "https://yuligo.yuliverse.io/api/g/v1/run/rewards";
        
        try {
            const headers = {
                ...this.baseHeaders,
                "X-Cookie-Id": cookieId
            };

            const response = await axios.get(url, { headers, httpsAgent: agent });

            if (response.status === 200) {
                const rewardsData = response.data;
                
                if (rewardsData.data && rewardsData.data.token_go) {
                    const tokenGo = rewardsData.data.token_go;
                    this.log(`Nhận ${tokenGo.yellow} Go token thành công`, 'success');
                    return rewardsData;
                } else {
                    this.log('Không tìm thấy thông tin token GO trong phản hồi', 'warning');
                    return null;
                }
            } else {
                this.log(`Không thể nhận phần thưởng: ${response.status}`, 'error');
                return null;
            }
        } catch (error) {
            this.log(`Lỗi khi nhận phần thưởng: ${error.message}`, 'error');
            return null;
        }
    }

    async fetchMissions(cookieId, agent) {
        const url = "https://yuligo.yuliverse.io/api/g/v1/missions?query_id=0";
        
        try {
            const headers = {
                ...this.baseHeaders,
                "X-Cookie-Id": cookieId
            };

            const response = await axios.get(url, { headers, httpsAgent: agent });

            if (response.status === 200) {
                const pendingMissions = response.data.data.filter(
                    mission => !mission.is_check_done && !mission.is_claimed
                );

                this.log(`Tìm thấy ${pendingMissions.length.toString()} nhiệm vụ chưa hoàn thành`, 'info');
                
                return pendingMissions;
            } else {
                this.log(`Không thể lấy danh sách nhiệm vụ: ${response.status}`, 'error');
                return [];
            }
        } catch (error) {
            this.log(`Lỗi khi lấy danh sách nhiệm vụ: ${error.message}`, 'error');
            return [];
        }
    }

    async completeMission(cookieId, mission, agent) {
        const url = "https://yuligo.yuliverse.io/api/g/v1/missions";
        
        try {
            const headers = {
                ...this.baseHeaders,
                "X-Cookie-Id": cookieId,
                "Content-Type": "application/json"
            };

            const payload = { id: mission.id };

            const response = await axios.post(url, payload, { headers, httpsAgent: agent });

            if (response.status === 200 && response.data.code === 0) {
                this.log(`Làm nhiệm vụ ${mission.name} thành công | Phần thưởng ${mission.mission_reward.amount} GO`, 'success');
                return true;
            } else {
                this.log(`Không thể hoàn thành nhiệm vụ ${mission.name}: ${response.data.msg || 'Lỗi không xác định'}`, 'error');
                return false;
            }
        } catch (error) {
            this.log(`Lỗi khi hoàn thành nhiệm vụ ${mission.name}: ${error.message}`, 'error');
            return false;
        }
    }

    async processMissions(cookieId, agent) {
        const pendingMissions = await this.fetchMissions(cookieId, agent);
        
        for (const mission of pendingMissions) {
            await this.completeMission(cookieId, mission, agent);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    async fetchRoles(cookieId, agent) {
        const url = "https://yuligo.yuliverse.io/api/g/v1/roles";
        
        try {
            const headers = {
                ...this.baseHeaders,
                "X-Cookie-Id": cookieId
            };

            const response = await axios.get(url, { headers, httpsAgent: agent });

            if (response.status === 200) {
                const rolesData = response.data.data;
                
                if (rolesData.length > 0) {
                    const mainRole = rolesData[0];
                    this.log(`Lấy thông tin vai trò thành công. Role ID: ${mainRole.role_id.yellow}`, 'success');
                    
                    this.log(`Level: ${mainRole.level}`, 'info');
                    this.log(`Run Rate: ${mainRole.run_rate}`, 'info');
                    
                    return mainRole;
                } else {
                    this.log('Không tìm thấy vai trò nào', 'warning');
                    return null;
                }
            } else {
                this.log(`Không thể lấy thông tin vai trò: ${response.status}`, 'error');
                return null;
            }
        } catch (error) {
            this.log(`Lỗi khi lấy thông tin vai trò: ${error.message}`, 'error');
            return null;
        }
    }

    async fetchRoleConfigs(cookieId, agent) {
        const url = "https://yuligo.yuliverse.io/api/g/v1/role_configs";
        
        try {
            const headers = {
                ...this.baseHeaders,
                "X-Cookie-Id": cookieId
            };

            const response = await axios.get(url, { headers, httpsAgent: agent });

            if (response.status === 200) {
                const roleConfigs = response.data.data;
                
                if (roleConfigs.length > 0) {
                    this.log('Lấy thông tin cấu hình vai trò thành công', 'success');
                    return roleConfigs[0];
                } else {
                    this.log('Không tìm thấy cấu hình vai trò', 'warning');
                    return null;
                }
            } else {
                this.log(`Không thể lấy thông tin cấu hình vai trò: ${response.status}`, 'error');
                return null;
            }
        } catch (error) {
            this.log(`Lỗi khi lấy thông tin cấu hình vai trò: ${error.message}`, 'error');
            return null;
        }
    }

    async upgradeRoleSkillsWithConfig(cookieId, roleId, profileData, roleConfigs, agent) {
        const url = "https://yuligo.yuliverse.io/api/g/v1/role/skill_upgrade";
        
        try {
            const headers = {
                ...this.baseHeaders,
                "X-Cookie-Id": cookieId,
                "Content-Type": "application/json"
            };

            const currentTokenGo = parseFloat(profileData.data.wallet_info.token_go);

            const skillNames = {
                1: 'Running Skills',
                2: 'Core Strength',
                3: 'Nav Skills',
                4: 'Breathing Skills',
                5: 'Pacing Skills',
                6: 'Mental Skills'
            };

            for (const skillId of [1, 2, 3, 4, 5, 6]) {
                const skillConfig = roleConfigs.role_skill_values.find(
                    skill => skill.skill_id === skillId
                );

                if (!skillConfig) {
                    this.log(`Không tìm thấy cấu hình cho kỹ năng ${skillId}`, 'warning');
                    continue;
                }

                const affordableLevels = skillConfig.values
                    .filter(level => parseFloat(level.cost) <= currentTokenGo)
                    .sort((a, b) => parseFloat(b.cost) - parseFloat(a.cost));

                const nextUpgradeLevel = affordableLevels.length > 0 ? affordableLevels[0] : null;

                if (nextUpgradeLevel) {
                    const payload = { 
                        role_id: roleId,
                        skill_id: skillId 
                    };

                    try {
                        const response = await axios.post(url, payload, { headers, httpsAgent: agent });

                        if (response.status === 200 && response.data.code === 0) {
                            this.log(
                                `Nâng cấp ${skillNames[skillId]} lên level ${nextUpgradeLevel.level} (Chi phí: ${nextUpgradeLevel.cost} GO)`, 
                                'success'
                            );
                        } else {
                            this.log(`Không thể nâng cấp kỹ năng ${skillNames[skillId]}: ${response.data.msg || 'Lỗi không xác định'}`, 'error');
                        }
                    } catch (error) {
                        this.log(`Lỗi khi nâng cấp kỹ năng ${skillNames[skillId]}: ${error.message}`, 'error');
                    }

                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    this.log(
                        `Không đủ Token GO để nâng cấp ${skillNames[skillId]}`, 
                        'warning'
                    );
                }
            }
        } catch (error) {
            this.log(`Lỗi khi nâng cấp kỹ năng: ${error.message}`, 'error');
        }
    }

    async main() {
        const dataFile = path.join(__dirname, 'data.txt');
        const proxyFile = path.join(__dirname, 'proxy.txt');

        const initDatas = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        const proxies = fs.readFileSync(proxyFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        const accountCount = Math.min(initDatas.length, proxies.length);
        if (initDatas.length !== proxies.length) {
            this.log(`Cảnh báo: Số lượng tài khoản (${initDatas.length}) và proxy (${proxies.length}) không khớp. Sẽ chỉ sử dụng ${accountCount} cặp đầu tiên.`, 'warning');
        }

        while(true) {
            for (let i = 0; i < accountCount; i++) {
                const initData = initDatas[i];
                const proxy = proxies[i];

                try {
                    const ip = await this.checkProxyIP(proxy);
                    this.log(`========== Tài khoản ${(i + 1).toString()} | IP: ${ip} ==========`, 'custom');
                } catch (proxyError) {
                    this.log(`Tài khoản ${(i + 1).toString()} - Proxy lỗi: ${proxyError.message}`, 'error');
                    this.log(`Bỏ qua tài khoản ${(i + 1).toString()} do lỗi proxy`, 'warning');
                    continue;
                }

                const proxyAgent = new HttpsProxyAgent(proxy);

                const cookieId = await this.login(initData, proxyAgent);
                
                if (cookieId) {
                    const profileData = await this.fetchUserProfile(cookieId, proxyAgent);
                    
                    await this.claimRewards(cookieId, proxyAgent);
                    await this.processMissions(cookieId, proxyAgent);
                    const roleConfigs = await this.fetchRoleConfigs(cookieId, proxyAgent);
        
                    const role = await this.fetchRoles(cookieId, proxyAgent);
                    if (role && roleConfigs && profileData) {
                        await this.upgradeRoleSkillsWithConfig(cookieId, role.role_id, profileData, roleConfigs, proxyAgent);
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    this.log(`Bỏ qua tài khoản ${i + 1} do lỗi đăng nhập`, 'warning');
                }
            }
            this.log('Đang chờ 1 giờ trước khi tiếp tục vòng lặp...', 'info');
            await this.countdown(60 * 60);
        }
    }
}

const client = new YuligoAPIClient();
client.main().catch(err => {
    client.log(err.message, 'error');
    process.exit(1);
});
