// WRITTEN BY IMSOFLY - DO NOT REMOVE THIS LINE

require('dotenv').config();

const fs = require('fs');
const botConfig = require('./config');
const Discord = require('discord.js');
const mysql = require('mysql');

const botName = "Vanity";
const prefix = "v?";
const bot = new Discord.Client();

bot.login(botConfig.token);

const serverConfig = {}; // for mysql variables data

const q = String.fromCharCode(96);

const catchErr = err => {
	console.log(err)
}

// DATABSE
let db = mysql.createConnection({
	host: botConfig.mysql.host,
	user: botConfig.mysql.user,
	database: botConfig.mysql.database,
	password: botConfig.mysql.password
});

db.connect(function(err) {
	if (err) throw err;
	console.log("Connected to remote mysql database.");
});

bot.on('ready', async() => {
    	console.info(`Logged in as ${bot.user.tag}!`);
			
	activityTimer();
	setInterval(activityTimer, 180000);
	
	bot.guilds.cache.forEach(g => {
		onGuildJoin(g);
	});
});

bot.on("presenceUpdate", async (oldMember, newMember) => {
	if (newMember != undefined && serverConfig[newMember.guild.id] == undefined) // wait for settings to load
		return;
		
	let guild = newMember.guild;
	let serverVanity = guild.vanityURLCode;	
	if (serverVanity == null) { // no vanity url in guild so ignore this feature
		return;
	}
	
	const oldActivity = oldMember != undefined ? (oldMember.activities[0] != undefined ? String(oldMember.activities[0].state) : undefined) : undefined;
	const newActivity = newMember != undefined ? (newMember.activities[0] != undefined ? String(newMember.activities[0].state) : undefined) : undefined;
	const emojiName = (newActivity != undefined && newMember.activities[0].emoji != undefined) ? newMember.activities[0].emoji.name : undefined;
		
	let vanityRole = guild.roles.cache.find(role => role.id === serverConfig[guild.id]["vanityrole"]);
		
	if (vanityRole == undefined) {
		return;
	}
	
	let serverMember = (await guild.members.fetch()).get(newMember.user.id);
	let hasActivityVanity = newActivity != undefined && newActivity.toLowerCase().includes(serverVanity);
	let hasEmojiVanity = emojiName != undefined && emojiName.toLowerCase().includes(serverVanity);
		
	if (serverMember != undefined)
	{
		if (hasActivityVanity || hasEmojiVanity) {
			if (!serverMember.roles.cache.has(vanityRole.id))
			{
				// console.log(`${newMember.user.tag} deserves a vanity role. ${vanityRole}`);
				await serverMember.roles.add(vanityRole).catch( err => {});
				log(guild, "vanitylogchannel", `**${newMember.user.tag}** has added **${serverVanity}** to their bio.`);
			}
		}
		else
		{
			if (serverMember.user.presence.status != "offline" && serverMember.roles.cache.has(vanityRole.id))
			{
				// console.log(`${newMember.user.tag} doesn't deserve a vanity role. ${vanityRole}`);
				await serverMember.roles.remove(vanityRole).catch( err => {});
				log(guild, "vanitylogchannel", `**${newMember.user.tag}** has **removed** vanity from their bio.`);
			}
		}
	}
	
	// console.log("[" + newMember.user.tag + "] Status changed from: \"" + oldActivity + "\" to: \"" + newActivity + "\"");
});

function activityTimer() {
	let count = bot.guilds.cache.size;
	let memberCount = bot.guilds.cache.map((g) => g.memberCount).reduce((a, c) => a + c);
	bot.user.setActivity(`Add .gg/views in bio | ${prefix}help`);
}

bot.on("guildCreate", async (guild) => {
	await onGuildJoin(guild);
});

async function onGuildJoin(guild) {
	refreshConfig(guild, () => {
		console.log(`Guild ${guild.id} ${guild.name} was loaded into the system.`)
	}, true);
}

bot.on('message', async(msg) => {
	if (msg.author.bot || msg.guild == null || msg.member == null)
		return;
	
	if (serverConfig[msg.guild.id] == undefined) // wait for settings to load
		return;
			
	let serverid = msg.guild.id;
				
	if (msg.content.startsWith(prefix))
	{
		const args = msg.content.slice(prefix.length).trim().split(' ');
		const command = args.shift().toLowerCase();
		const isAdmin = msg.member.hasPermission("ADMINISTRATOR");
		
		if (command == "invitebot" || command == "invite")
		{
			msg.reply(`https://discord.com/oauth2/authorize?client_id=870780243848335410&permissions=8&scope=bot`);
		}
		else if (command == "support")
		{
			try {
				msg.member.send("You can contact our support server here: https://discord.gg/FbXJZVZFF3");
			} catch {
				msg.reply("I was unable to DM you an invite to our support server! Please make sure your DMs are open.");
			}
		}
		else if (command == "botstats")
		{
			let memberCount = bot.guilds.cache.map((g) => g.memberCount).reduce((a, c) => a + c);
			msg.reply(`I have been added to **${bot.guilds.cache.size}** servers!\r\nThere are **${memberCount} users** in these servers total.\r\nYou can use **${prefix}invite** to invite me to other servers.`);
		}
		else if (command == "vanity")
		{
			let vanityURL = msg.guild.vanityURLCode;
			if (vanityURL == null)
			{
				msg.reply(`This server does not have a vanity url. Vanity role features cannot be used.`);
			}
			else 
			{
				msg.reply(`The vanity url for this server is: **${vanityURL}**`);
			}
		}
		else if (command == "vanityrole")
		{
			if (!isAdmin) { msg.reply('You do not have administrator perms to use this command.'); return; }
			if (isvalidrole(args[0]))
			{				
				try 
				{
					let vanityRole = args[0] != '0' ? args[0].slice(3, -1) : undefined;
					db.query(`UPDATE vanity SET vanityrole='${vanityRole != undefined ? vanityRole : 0}' WHERE serverid = '${serverid}';`, async(err, result, fields) => {
						if (err) return console.error(err);
						refreshConfig(msg.guild, () => {
							if (vanityRole != undefined) {
								msg.reply(`You have changed the vanity role to: <@&${serverConfig[msg.guild.id]["vanityrole"]}>`);
							} else {
								msg.reply(`You have **unset** the vanity role. Vanity role updates will no longer be tracked.`);
							}
						}, false);
					});
				} catch (exception) {
					msg.reply('You must give me permissions to access that role first.');
					console.log(exception);
				}
			}
			else 
			{
				msg.reply(`Usage: ${prefix}vanityrole <role>\r\n**Current Value:** ${serverConfig[msg.guild.id]["vanityrole"]}`);
			}
		}
		else if (command == "vanitylog")
		{
			if (!isAdmin) { msg.reply('You do not have administrator perms to use this command.'); return; }
			if (isvalidchannel(args[0]))
			{				
				try 
				{
					let channel = args[0] != '0' ? bot.channels.cache.get(args[0].slice(2, -1)) : undefined;
					db.query(`UPDATE vanity SET vanitylogchannel='${channel != undefined ? channel.id : 0}' WHERE serverid = '${serverid}';`, async(err, result, fields) => {
						if (err) return console.error(err);
						refreshConfig(msg.guild, () => { 
							if (channel != undefined) {
								msg.reply(`Vanity changes will now be posted in: <#${serverConfig[msg.guild.id]["vanitylogchannel"]}>`);
							} else {
								msg.reply(`You have **unset** the vanity log channel for this server.`);
							}
						}, false);
					});
				} catch (exception) {
					msg.reply('You must give me permissions to access that channel first.');
				}
			}
			else 
			{
				msg.reply(`Usage: ${prefix}vanitylog <channel>\r\n**Current Value:** ${serverConfig[msg.guild.id]["vanitylogchannel"]}`);
			}
		}
		
	}
	
});

function isFly(txt) {
	return txt == fly1 || txt == fly2;
}

function cleanAscii(txt) {
	return txt.replace(/[^\x00-\x7F]/g, "");
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function tilde() {
	return chr(96);
}

function getUserFromMention(mention) {
	if (!mention) return;

	if (mention.startsWith('<@') && mention.endsWith('>')) {
		mention = mention.slice(2, -1);

		if (mention.startsWith('!')) {
			mention = mention.slice(1);
		}

		return bot.users.cache.get(mention);
	}
}

function isvaliduser(txt) {
	return new RegExp("^<@!\\d{18}>+$").test(txt) || new RegExp("^<@\\d{18}>+$").test(txt);
}

function isvalidchannel(txt) {
	return txt == '0' || new RegExp("^<#\\d{18}>+$").test(txt);
}

function isvalidrole(txt) {
	return txt == '0' || new RegExp("^<@&\\d{18}>+$").test(txt);
}

async function db_get(query, callback)
{
	db.query(query, function (err, result, fields) {
		if (err) return console.log(err);
		callback(result);
	});
}

async function db_all(query, callback){
    return new Promise(function(resolve,reject){
		db.query(query, function (err, result, fields) {
			if(err){return reject(err);}
			callback(result);
			resolve(result);
		});
    });
}

bot.on('guildMemberAdd', async(member) => {
	if (serverConfig[member.guild.id] == undefined) // wait for settings to load
		return;
	
});

bot.on("guildMemberRemove", (member) => {		
	let id = member.user.id;
	let serverid = member.guild.id;
	
	if (serverConfig[serverid] == undefined) // wait for settings to load
		return;
		
});

function log(guild, key, message)
{
	let configSetting = serverConfig[guild.id][key];
	if (configSetting != "" && configSetting != "0")
	{
		guild.fetch().then((g) => {
			let channel = bot.channels.cache.get(serverConfig[guild.id][key]);
			if (channel != undefined) {
				channel.send(message).catch( err => { });
			}
		}).catch(catchErr);
	}
}

function refreshConfig(guild, callback, resetConfig) {
	let serverid = guild.id;
	
	db_get(`SELECT COUNT(*) FROM vanity WHERE serverid = ${serverid};`, (rows) => {	
		if (!rows[0]["COUNT(*)"]) {
			createConfig(guild, callback);
		} else {
			loadConfig(guild, callback, resetConfig);
		}
	});
}

function loadConfig(guild, callback, resetConfig)
{
	let serverid = guild.id;
	
	db_get(`SELECT * FROM vanity WHERE serverid = ${serverid};`, (rows) => {		
		serverConfig[serverid] = rows[0];
		if (callback != undefined) {
			callback();
		}
	});
}

function createConfig(guild, callback) {
	let serverid = guild.id;
	
	db.query(`INSERT INTO vanity (serverid, vanityrole, vanitylogchannel) VALUES ('${serverid}', '0', '0')`, (err, result, fields) => {
		if (err) return console.error(err);
		return loadConfig(guild, callback, true);
	});
}