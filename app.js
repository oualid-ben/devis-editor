// =============================================
// CONFIGURATION ET CONSTANTES
// =============================================
const CONFIG = {
  tvaParDefaut: 20,
  devise: '€',
  dateFormat: { year: 'numeric', month: '2-digit', day: '2-digit' }
};

// =============================================
// ÉTAT DE L'APPLICATION
// =============================================
const state = {
  devis: {
    numero: `D-${new Date().getTime().toString().slice(-6)}`,
    date: new Date().toLocaleDateString('fr-FR', CONFIG.dateFormat),
    objet: '',
    client: {
      nom: '',
      adresse: ''
    },
    artisan: {
      nom: 'Entreprise ABC',
      adresse: '12 rue des Lilas, 75000 Paris',
      telephone: '',
      email: '',
      siret: ''
    },
    prestations: [],
    conditions: {
      paiement: '30% à la commande, solde à la livraison',
      delai: '15 jours après signature'
    }
  },
  ui: {
    loading: false
  }
};

// =============================================
// INITIALISATION DE L'APPLICATION
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  // Charger les données depuis l'URL si présentes
  chargerDonneesDepuisURL();
  
  // Initialiser l'interface
  initialiserFormulaire();
  
  // Configurer les écouteurs d'événements
  configurerEcouteurs();
  
  // Calculer les totaux initiaux
  calculerTotaux();
});

// =============================================
// FONCTIONS D'INITIALISATION
// =============================================
function chargerDonneesDepuisURL() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('data')) {
    try {
      const data = JSON.parse(decodeURIComponent(urlParams.get('data')));
      Object.assign(state.devis, data);
    } catch (e) {
      console.error('Erreur de parsing des données URL:', e);
    }
  }
}

function initialiserFormulaire() {
  // Remplir les champs du formulaire
  document.getElementById('numeroDevis').value = state.devis.numero;
  document.getElementById('dateDevis').value = state.devis.date;
  // ... autres champs

  // Afficher les prestations existantes
  state.devis.prestations.forEach((prestation, index) => {
    ajouterLignePrestation(prestation, index);
  });
}

function configurerEcouteurs() {
  // Boutons d'action
  document.getElementById('add-line').addEventListener('click', ajouterLignePrestation);
  document.getElementById('generate-pdf').addEventListener('click', genererPDF);
  
  // Écouteurs de formulaire
  document.querySelectorAll('#form-sections input, #form-sections select, #form-sections textarea').forEach(input => {
    input.addEventListener('input', sauvegarderValeur);
  });
}

// =============================================
// GESTION DES PRESTATIONS
// =============================================
function ajouterLignePrestation(prestation = {}, index = state.devis.prestations.length) {
  const template = document.getElementById('prestation-template');
  const clone = template.content.cloneNode(true);
  const tr = clone.querySelector('tr');
  
  // Remplir les valeurs si une prestation existe
  if (prestation.description) {
    tr.querySelector('.prestation-desc').value = prestation.description;
    tr.querySelector('.prestation-qte').value = prestation.quantite || 1;
    tr.querySelector('.prestation-unit').value = prestation.unite || '';
    tr.querySelector('.prestation-price').value = prestation.prix || 0;
    tr.querySelector('.prestation-tva').value = prestation.tva || CONFIG.tvaParDefaut;
  }
  
  // Gestion de la suppression
  tr.querySelector('.remove-line').addEventListener('click', () => {
    tr.remove();
    state.devis.prestations.splice(index, 1);
    calculerTotaux();
  });
  
  // Écouteurs de modification
  tr.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => {
      mettreAJourPrestation(index, tr);
      calculerTotaux();
    });
  });
  
  // Ajouter au DOM et à l'état
  document.querySelector('#table-prestations tbody').appendChild(tr);
  
  if (!prestation.description) {
    state.devis.prestations.push({
      description: '',
      quantite: 1,
      unite: '',
      prix: 0,
      tva: CONFIG.tvaParDefaut
    });
  }
}

function mettreAJourPrestation(index, tr) {
  state.devis.prestations[index] = {
    description: tr.querySelector('.prestation-desc').value,
    quantite: parseFloat(tr.querySelector('.prestation-qte').value) || 0,
    unite: tr.querySelector('.prestation-unit').value,
    prix: parseFloat(tr.querySelector('.prestation-price').value) || 0,
    tva: parseFloat(tr.querySelector('.prestation-tva').value) || 0
  };
}

// =============================================
// CALCULS FINANCIERS
// =============================================
function calculerTotaux() {
  let totalHT = 0;
  let totalTVA = 0;
  
  // Calculer pour chaque ligne
  document.querySelectorAll('#table-prestations tbody tr').forEach((tr, index) => {
    const qte = parseFloat(tr.querySelector('.prestation-qte').value) || 0;
    const prix = parseFloat(tr.querySelector('.prestation-price').value) || 0;
    const tva = parseFloat(tr.querySelector('.prestation-tva').value) || 0;
    
    const ht = qte * prix;
    const ttc = ht * (1 + tva / 100);
    
    tr.querySelector('.ht').textContent = ht.toFixed(2) + ' ' + CONFIG.devise;
    tr.querySelector('.ttc').textContent = ttc.toFixed(2) + ' ' + CONFIG.devise;
    
    totalHT += ht;
    totalTVA += ht * (tva / 100);
  });
  
  // Mettre à jour les totaux globaux
  const totalTTC = totalHT + totalTVA;
  
  document.getElementById('totaux-container').innerHTML = `
    <div class="total-item">
      <span>Total HT:</span>
      <span>${totalHT.toFixed(2)} ${CONFIG.devise}</span>
    </div>
    <div class="total-item">
      <span>TVA:</span>
      <span>${totalTVA.toFixed(2)} ${CONFIG.devise}</span>
    </div>
    <div class="total-item" style="font-weight:bold;">
      <span>Total TTC:</span>
      <span>${totalTTC.toFixed(2)} ${CONFIG.devise}</span>
    </div>
  `;
}

// =============================================
// GÉNÉRATION PDF
// =============================================
async function genererPDF() {
  const { jsPDF } = window.jspdf;
  state.ui.loading = true;
  document.getElementById('loading-overlay').style.display = 'flex';
  
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // En-tête
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('DEVIS', 105, 20, { align: 'center' });
    
    // Informations de base
    doc.setFontSize(10);
    doc.text(`N°: ${state.devis.numero}`, 190, 15, { align: 'right' });
    doc.text(`Date: ${state.devis.date}`, 190, 20, { align: 'right' });
    
    // ... (compléter avec le reste de votre logique PDF)
    
    // Sauvegarder le PDF
    doc.save(`devis_${state.devis.numero}.pdf`);
    
  } catch (error) {
    console.error('Erreur génération PDF:', error);
    alert('Une erreur est survenue lors de la génération du PDF');
  } finally {
    state.ui.loading = false;
    document.getElementById('loading-overlay').style.display = 'none';
  }
}

// =============================================
// UTILITAIRES
// =============================================
function sauvegarderValeur(e) {
  const field = e.target.id;
  const value = e.target.value;
  
  // Mapper les champs à l'état
  switch(field) {
    case 'numeroDevis':
      state.devis.numero = value;
      break;
    case 'clientNom':
      state.devis.client.nom = value;
      break;
    // ... autres champs
  }
}

// Pour la communication avec n8n/WhatsApp
window.chargerDonneesExternes = (data) => {
  Object.assign(state.devis, data);
  initialiserFormulaire();
};
