import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bell, Plus, Play, Search, Settings, Square, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { axSpacing, axTypography } from '../../theme/axTokens';
import {
  AxButton, AxCard, AxCheckbox, AxChip, AxCounterBadge, AxDayItem, AxIconButton, AxPageHeader,
  AxStatusDot, AxSwitch, AxTag, AxTextField,
} from '../../components/ax';

/**
 * Catalogue des composants ax (développement uniquement : enregistré dans la
 * navigation seulement quand __DEV__ est vrai). L'interrupteur du haut bascule
 * le thème de l'app pour voir chaque composant en sombre et en clair.
 */
export default function AxCatalogScreen() {
  const { theme, toggleTheme } = useTheme();
  const c = theme.ax;
  const [chip, setChip] = useState('Tous');
  const [switchOn, setSwitchOn] = useState(true);
  const [checked, setChecked] = useState(true);
  const [day, setDay] = useState(3);
  const [text, setText] = useState('');

  const section = (title: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <Text style={[axTypography.overline, { color: c.textMuted }]}>{title}</Text>
      {children}
    </View>
  );

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.content}>
      <AxPageHeader title="Composants" subtitle={`Refonte AthleX — thème ${theme.mode === 'dark' ? 'sombre' : 'clair'}`} />
      <View style={styles.body}>
        <View style={styles.row}>
          <AxSwitch value={theme.mode === 'dark'} onValueChange={toggleTheme} accessibilityLabel="Thème sombre" />
          <Text style={[axTypography.bodySmall, { color: c.text }]}>Thème sombre</Text>
        </View>

        {section('Boutons', (
          <View style={styles.stack}>
            <AxButton variant="accent" label="Démarrer" icon={Play} onPress={() => {}} />
            <AxButton variant="outline" label="Contour" icon={Settings} onPress={() => {}} />
            <AxButton variant="light" label="Clair" onPress={() => {}} />
            <AxButton variant="dashed" label="Ajouter un mouvement" icon={Plus} onPress={() => {}} />
            <AxButton variant="stop" label="Arrêter" icon={Square} onPress={() => {}} />
            <AxButton variant="accent" label="Chargement" loading onPress={() => {}} />
            <AxButton variant="accent" label="Désactivé" disabled onPress={() => {}} />
            <AxButton variant="accent" label="Pleine largeur" fullWidth onPress={() => {}} />
          </View>
        ))}

        {section('Bouton carré', (
          <View style={styles.row}>
            <AxIconButton icon={Search} accessibilityLabel="Rechercher" onPress={() => {}} />
            <AxIconButton icon={Bell} accessibilityLabel="Notifications" onPress={() => {}} />
            <AxIconButton icon={Trash2} accessibilityLabel="Supprimer" disabled onPress={() => {}} />
          </View>
        ))}

        {section('Pastilles', (
          <View style={styles.wrap}>
            {['Tous', 'Functional', 'Hybrid', 'Musculation'].map((l) => (
              <AxChip key={l} label={l} selected={chip === l} onPress={() => setChip(l)} />
            ))}
          </View>
        ))}

        {section('Étiquettes, badge, états', (
          <View style={styles.stack}>
            <View style={styles.row}>
              <AxTag label="RX" tone="accent" />
              <AxTag label="Scaled" tone="muted" />
              <AxCounterBadge count={3} />
              <AxCounterBadge count={120} />
            </View>
            <AxStatusDot label="Actif" tone="active" />
            <AxStatusDot label="En pause" tone="muted" />
            <AxStatusDot label="Impayé" tone="danger" />
            <AxStatusDot label="Expire bientôt" tone="warning" />
          </View>
        ))}

        {section('Cartes', (
          <View style={styles.stack}>
            <AxCard variant="standard">
              <Text style={[axTypography.overline, { color: c.textMuted }]}>Standard</Text>
              <Text style={[axTypography.titleM, { color: c.text }]}>WOD du jour</Text>
              <Text style={[axTypography.bodySmall, { color: c.textMuted }]}>21-15-9 thrusters et tractions.</Text>
            </AxCard>
            <AxCard variant="featured">
              <Text style={[axTypography.overline, { color: c.textMuted }]}>Vedette</Text>
              <Text style={[axTypography.titleL, { color: c.text }]}>Tournoi du samedi</Text>
              <Text style={[axTypography.bodySmall, { color: c.textMuted }]}>Inscriptions ouvertes jusqu'à vendredi.</Text>
            </AxCard>
            <AxCard variant="glass" onPress={() => {}} accessibilityLabel="Carte verre">
              <Text style={[axTypography.overline, { color: c.textMuted }]}>Verre</Text>
              <Text style={[axTypography.titleM, { color: c.text }]}>Carte cliquable</Text>
              <Text style={[axTypography.bodySmall, { color: c.textMuted }]}>Toute la carte réagit au toucher.</Text>
            </AxCard>
          </View>
        ))}

        {section('Champs', (
          <View style={styles.stack}>
            <AxTextField value={text} onChangeText={setText} placeholder="Rechercher un athlète" icon={Search} />
            <AxTextField value="12 kg" onChangeText={() => {}} placeholder="Charge" error="La charge doit être un nombre." />
          </View>
        ))}

        {section('Interrupteur et case', (
          <View style={styles.stack}>
            <View style={styles.row}>
              <AxSwitch value={switchOn} onValueChange={setSwitchOn} accessibilityLabel="Notifications" />
              <AxSwitch value={false} onValueChange={() => {}} disabled accessibilityLabel="Désactivé" />
            </View>
            <AxCheckbox checked={checked} onChange={setChecked} label="J'accepte le règlement" />
            <AxCheckbox checked={false} onChange={() => {}} label="Case vide" />
          </View>
        ))}

        {section('Jours', (
          <View style={styles.row}>
            {['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'].map((l, i) => (
              <AxDayItem key={l} dayLabel={l} dayNumber={21 + i} selected={day === i} onPress={() => setDay(i)} />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 60, paddingBottom: 60, gap: axSpacing['2xl'] },
  body: { paddingHorizontal: axSpacing.xl, gap: axSpacing['2xl'] },
  section: { gap: axSpacing.md },
  stack: { gap: axSpacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: axSpacing.sm },
});
