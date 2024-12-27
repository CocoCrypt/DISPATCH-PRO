// endService.js - Commande pour terminer le service et calculer la durée
module.exports = {
    data: {
      name: 'endService',
      description: 'Terminez votre service et obtenez la durée.'
    },
    async execute(interaction) {
      const userId = interaction.user.id;
  
      // Vérifiez si l'utilisateur a commencé un service
      if (!interaction.client.serviceData || !interaction.client.serviceData[userId]) {
        return await interaction.reply("Vous n'avez pas commencé de service.");
      }
  
      // Récupérer l'heure de début du service
      const startTime = interaction.client.serviceData[userId].startTime;
      const endTime = Date.now(); // L'heure actuelle est la fin du service
  
      // Calculer la durée en millisecondes
      const duration = endTime - startTime;
      
      // Convertir la durée en minutes et secondes
      const minutes = Math.floor(duration / 60000);
      const seconds = Math.floor((duration % 60000) / 1000);
  
      // Répondre à l'utilisateur avec la durée du service
      await interaction.reply(`Votre service a duré ${minutes} minutes et ${seconds} secondes.`);
  
      // Optionnel : Vous pouvez supprimer l'utilisateur du dictionnaire de service après la fin du service
      delete interaction.client.serviceData[userId];
    }
  };
  