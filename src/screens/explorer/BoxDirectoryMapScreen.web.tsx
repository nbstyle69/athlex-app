import React from 'react';
import { View, Text } from 'react-native';
import i18n from '../../i18n';

export default function BoxDirectoryMapScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>{i18n.t('explorer.map.webUnavailable')}</Text>
    </View>
  );
}
