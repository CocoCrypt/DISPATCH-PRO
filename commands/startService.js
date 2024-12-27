// startService.js - Commande pour commencer le service
module.exports = {
  data: {
    name: 'startService',
    description: 'Commencez votre service.'
  },
  async execute(interaction) {
    // Stocker l'heure de début du service dans la mémoire du bot (peut aussi être une base de données)
    const userId = interaction.user.id;
    const startTime = Date.now(); // Obtenir l'heure actuelle en millisecondes
    
    // Sauvegarder cette information dans un "dictionnaire" ou un objet (en mémoire)
    if (!interaction.client.serviceData) {
      interaction.client.serviceData = {}; // Initialiser si ce n'est pas déjà fait
    }
    
    interaction.client.serviceData[userId] = { startTime };
    
    // Répondre à l'utilisateur
    await interaction.reply(`Votre service a commencé à ${new Date(startTime).toLocaleString()}.`);
  }
};
