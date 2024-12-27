const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const moment = require('moment');
const fs = require('fs');
const QuickChart = require('quickchart-js');
require('dotenv').config();

// Constantes pour les seuils
const MAX_SERVICE_DURATION = moment.duration(2, 'hours');
const MAX_PAUSE_DURATION = moment.duration(30, 'minutes');

// Variables globales pour suivre les services et les pauses
let serviceStartTimes = {};
let servicePausedTimes = {};
let totalPauseTimes = {};
let serviceInPause = {};
let userWeeklyHours = {}; // Stocke les heures travaillées par utilisateur

// Stockage des évaluations
const EVALUATIONS_FILE = './evaluations.json';
let serviceEvaluations = {};

// Charger les données sauvegardées depuis un fichier JSON
const DATA_FILE = './weeklyHours.json';

function loadWeeklyData() {
  if (fs.existsSync(DATA_FILE)) {
    userWeeklyHours = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
}

function saveWeeklyData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(userWeeklyHours, null, 2));
}

function loadEvaluations() {
  if (fs.existsSync(EVALUATIONS_FILE)) {
    serviceEvaluations = JSON.parse(fs.readFileSync(EVALUATIONS_FILE, 'utf8'));
  }
}

function saveEvaluations() {
  fs.writeFileSync(EVALUATIONS_FILE, JSON.stringify(serviceEvaluations, null, 2));
}

// Création du client Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Enregistrement des commandes
client.once('ready', async () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);
  console.log(`Le bot est présent dans ${client.guilds.cache.size} serveurs.`);

  const commands = [
    new SlashCommandBuilder().setName('service').setDescription('Prendre votre service').toJSON(),
    new SlashCommandBuilder().setName('fin').setDescription('Terminer votre service et calculer la durée.').toJSON(),
    new SlashCommandBuilder().setName('pause').setDescription('Mettre votre service en pause.').toJSON(),
    new SlashCommandBuilder().setName('reprendre').setDescription('Reprendre votre service après une pause.').toJSON(),
    new SlashCommandBuilder().setName('heures-semaine').setDescription('Voir les heures travaillées cette semaine.')
      .addUserOption(option =>
        option.setName('utilisateur')
          .setDescription("L'utilisateur à vérifier")
          .setRequired(false))
      .toJSON(),
    new SlashCommandBuilder()
      .setName('reset-heures')
      .setDescription('Réinitialise les heures travaillées de tout le monde.')
      .toJSON(),
    new SlashCommandBuilder()
      .setName('evaluer')
      .setDescription('Évaluer la qualité de votre service.')
      .addIntegerOption(option =>
        option.setName('note')
          .setDescription('Donnez une note de 1 à 5.')
          .setRequired(true))
      .toJSON(),
    new SlashCommandBuilder()
      .setName('moyenne-evaluations')
      .setDescription('Voir la moyenne des évaluations.')
      .addUserOption(option =>
        option.setName('utilisateur')
          .setDescription("L'utilisateur à vérifier")
          .setRequired(false))
      .toJSON(),
    new SlashCommandBuilder()
       .setName('faq')
       .setDescription('Poser une question fréquemment posée.')
       .addStringOption(option =>
        option.setName('question')
        .setDescription('Sélectionnez une question fréquemment posée')
        .setRequired(true)
        .addChoices(
          { name: 'Règles du service', value: 'regles_service' },
        { name: 'Contact', value: 'contact' },
        { name: 'Autre', value: 'autre' },
        { name: 'Code Vestimentaire', value: 'tenue' },
        { name: 'Absences', value: 'retards_absences' },
        { name: 'Parking / Stationnement', value: 'stationnement' },
        { name: 'Support', value: 'support_technique' },
        { name: 'Event', value: 'evenements_internes' },
        { name: 'Equipement', value: 'equipements' },
        { name: 'Formation', value: 'formation' },
        { name: 'Pause', value: 'pauses' },
      ))
        .toJSON(),
      new SlashCommandBuilder()
      .setName('graphique-heures')
      .setDescription('Afficher un graphique des heures travaillées cette semaine.')
      .toJSON(),
      ];


  try {
    await client.application.commands.set(commands);
    console.log('Commandes enregistrées avec succès!');
  } catch (error) {
    console.error("Erreur d'enregistrement des commandes:", error);
  }

  // Charger les données sauvegardées
  loadWeeklyData();
  loadEvaluations();
});

// Gestion des interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, user } = interaction;

  // Commande "service"
  if (commandName === 'service') {
    if (serviceStartTimes[user.id]) {
      return interaction.reply({ content: 'Vous avez déjà pris votre service !', ephemeral: true });
    }

    serviceStartTimes[user.id] = moment();
    totalPauseTimes[user.id] = moment.duration(0);

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('EN SERVICE')
      .setDescription(`Vous avez pris votre service, <@${user.id}> ! ✅`)
      .setFooter({ text: 'Merci d\'avoir pris votre service.' });

    await interaction.reply({ embeds: [embed] });
  }

  // Commande "pause"
  else if (commandName === 'pause') {
    if (!serviceStartTimes[user.id]) {
      return interaction.reply({ content: "Vous n'avez pas encore pris votre service.", ephemeral: true});
    }

    if (serviceInPause[user.id]) {
      return interaction.reply({ content: 'Votre service est déjà en pause.', ephemeral: true});
    }

    servicePausedTimes[user.id] = moment();
    serviceInPause[user.id] = true;

    const embed = new EmbedBuilder()
      .setColor('#FFFF00')
      .setTitle('PAUSE')
      .setDescription(`Vous êtes en pause, <@${user.id}> ! ⏸️`)
      .setFooter({ text: 'Revenez bientôt.' });

    await interaction.reply({ embeds: [embed] });
  }

  // Commande "reprendre"
  else if (commandName === 'reprendre') {
    if (!serviceInPause[user.id]) {
      return interaction.reply({content: 'Vous n\'êtes pas en pause.', ephemeral: true});
    }

    const pauseStartTime = servicePausedTimes[user.id];
    const pauseDuration = moment.duration(moment().diff(pauseStartTime));

    if (pauseDuration > MAX_PAUSE_DURATION) {
      return interaction.reply({content: "Votre pause a dépassé la durée maximale autorisée (30 minutes).", ephemeral: true});
    }

    totalPauseTimes[user.id] = totalPauseTimes[user.id].add(pauseDuration);
    serviceInPause[user.id] = false;
    delete servicePausedTimes[user.id];

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('REPRISE DE SERVICE')
      .setDescription(`Vous avez repris votre service, <@${user.id}> ! ▶️`)
      .setFooter({ text: 'Bon courage pour le reste de votre service.' });

    await interaction.reply({ embeds: [embed] });
  }

  // Commande "fin"
  else if (commandName === 'fin') {
    if (!serviceStartTimes[user.id]) {
      return interaction.reply({ content: "Vous n'avez pas encore pris votre service.", ephemeral: true });
    }

    const startTime = serviceStartTimes[user.id];
    const endTime = moment();
    const totalDuration = moment.duration(endTime.diff(startTime)).subtract(totalPauseTimes[user.id]);

    // Ajouter la durée au total hebdomadaire
    if (!userWeeklyHours[user.id]) userWeeklyHours[user.id] = 0;
    userWeeklyHours[user.id] += totalDuration.asHours();

    saveWeeklyData(); // Sauvegarder les données

    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('FIN DE SERVICE')
      .setDescription(`Vous avez terminé votre service, <@${user.id}> ! ❌`)
      .addFields(
        { name: 'Durée totale du service', value: `${totalDuration.hours()}h ${totalDuration.minutes()}m ${totalDuration.seconds()}s` }
      )
      .setFooter({ text: 'Merci d\'avoir utilisé notre bot.' });

    await interaction.reply({ embeds: [embed] });

    delete serviceStartTimes[user.id];
    delete servicePausedTimes[user.id];
    delete totalPauseTimes[user.id];
    delete serviceInPause[user.id];
  }

  // Commande "evaluer"
  else if (commandName === 'evaluer') {
    const note = interaction.options.getInteger('note');

    if (note < 1 || note > 5) {
      return interaction.reply({ content: '❌ La note doit être entre 1 et 5.', ephemeral: true });
    }

    if (!serviceEvaluations[user.id]) {
      serviceEvaluations[user.id] = [];
    }

    serviceEvaluations[user.id].push(note);
    saveEvaluations();

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('ÉVALUATION DU SERVICE')
      .setDescription(`<@${user.id}>, merci pour votre évaluation ! ⭐️`)
      .addFields({ name: 'Note donnée', value: `${note} étoile(s)` })
      .setFooter({ text: 'Votre retour est important pour nous.' });

    await interaction.reply({ embeds: [embed] });
  }

  // Commande "moyenne-evaluations"
  else if (commandName === 'moyenne-evaluations') {
    const targetUser = interaction.options.getUser('utilisateur') || user;
    const evaluations = serviceEvaluations[targetUser.id] || [];

    if (evaluations.length === 0) {
      return interaction.reply({ content: `❌ Aucun avis trouvé pour <@${targetUser.id}>.`, ephemeral: true });
    }

    const moyenne = evaluations.reduce((a, b) => a + b, 0) / evaluations.length;

    const embed = new EmbedBuilder()
      .setColor('#1E90FF')
      .setTitle('MOYENNE DES ÉVALUATIONS')
      .setDescription(`Voici la moyenne des évaluations pour <@${targetUser.id}> :`)
      .addFields({ name: 'Moyenne', value: `${moyenne.toFixed(2)} étoile(s)` })
      .setFooter({ text: 'Merci de vos retours.' });

    await interaction.reply({ embeds: [embed] });
  }
  
    if (commandName === 'faq') {
      const question = interaction.options.getString('question');
      let response;
  
      switch (question) {
        case 'regles_service':
          response = "📜 **Règles du service** :\n1️⃣ Soyez respectueux envers les collègues et clients.\n2️⃣ Respectez les horaires fixés.\n3️⃣ Signalez toute absence ou retard.";
          break;
  
        case 'contact':
          response = "📞 **Contact** :\nPour toute question ou problème, contactez votre superviseur.";
          break;

        case 'tenue':
            response = "👔 **Code vestimentaire** :\nVeuillez porter une tenue professionelle adapté au poste. Les exceptions peuvent etre discutées avec votre supérieur."
            break;

        case 'retards_absences':
              response = "🚨 **Retards et absences** :\n En cas de retard ou d'absence, veuillez en informer votre superviseur dès que possible par téléphone ou par mail."
              break;

        case 'stationnement':
            response = "🚗 **Stationnement** :\nUn parking est disponible pour les employés. Merci d'utiliser les emplacements désignés pour éviter tout désagrément.";
            break;

            case 'support_technique':
              response = "🛠️ **Support technique** :\nPour toute assistance technique, contactez notre service IT via l'email support.tech@entreprise.com ou au poste 1234.";
              break;

              case 'evenements_internes':
                response = "🎉 **Événements internes** :\nNous organisons régulièrement des événements pour renforcer l'esprit d'équipe. Consultez le calendrier des événements pour plus de détails.";
                break;

                case 'equipements':
                  response = "🖥️ **Utilisation des équipements** :\nLes équipements de l'entreprise doivent être utilisés uniquement à des fins professionnelles. Signalez tout problème technique au service informatique.";
                  break;
                    

            case 'formation':
              response = "📚 **Formation** :\n Des formations sont organisées très régulièrement pour développer vos compétences. Consultez le calendrier ou demandez a votre supérieur."
              break;

        case 'pauses':
          response = "☕ **Politique de pauses** :\n Vous avez droit à une pause de 15 min toutes les 1h30 travaillées. Merci de respecter ces horaires pour le bon fonctionnement du service."
          break;
  
        case 'autre':
          response = "❓ **Autre question** :\nSi vous avez une question spécifique, veuillez la poser directement à votre superviseur ou directement a la direction !";
          break;
  
        default:
          response = "❌ Désolé, je n'ai pas compris votre question. Veuillez réessayer.";
      }
  
      await interaction.reply({ content: response, ephemeral: true });
    }

    else if (commandName === 'graphique-heures') {
      // Données utilisateur
      const hoursData = Array.isArray(userWeeklyHours[user.id]) 
        ? userWeeklyHours[user.id] 
        : [0, 0, 0, 0, 0, 0, 0];
      const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    
      // Configuration du graphique
      const chart = new QuickChart()
        .setConfig({
          type: 'bar',
          data: {
            labels: daysOfWeek,
            datasets: [{
              label: 'Heures travaillées',
              data: hoursData,
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1,
            }],
          },
          options: {
            scales: {
              y: { beginAtZero: true },
            },
          },
        })
        .setWidth(800)
        .setHeight(400)
        .setBackgroundColor('white');
    
      // Génération du graphique
      let chartUrl;
      try {
        chartUrl = chart.getUrl();
      } catch (error) {
        console.error('Erreur lors de la génération du graphique :', error);
        return interaction.reply({ content: '❌ Une erreur est survenue lors de la génération du graphique.', ephemeral: true });
      }
    
      // Envoi du graphique
      const embed = new EmbedBuilder()
        .setColor('#1E90FF')
        .setTitle('Graphique des heures travaillées')
        .setDescription(`Voici un graphique des heures travaillées cette semaine pour <@${user.id}>.`)
        .setImage(chartUrl)
        .setFooter({ text: 'Merci pour votre utilisation, by AyZann' });
    
      await interaction.reply({ embeds: [embed] });
    }
    
  });

// Se connecter au bot avec le token directement dans le code
client.login('').catch(console.error);
