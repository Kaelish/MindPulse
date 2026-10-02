import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { registerThemeStyles, tone, toneBg } from '../../theme/theme';
import {
  PATIENT_FILE_FILTERS,
  PatientFileCategory,
  PatientFileItem,
  createMyFileUrl,
  fetchMyFiles,
  formatFileDate,
  formatFileSize,
  patientFileCategoryLabel,
} from '../../services/patientFiles';

const CATEGORY_ICONS: Record<PatientFileCategory, keyof typeof Ionicons.glyphMap> = {
  prescription: 'medkit-outline',
  lab_test: 'flask-outline',
  other_note: 'document-text-outline',
};

export const MyFilesSection: React.FC = () => {
  const [filter, setFilter] = useState<'all' | PatientFileCategory>('all');
  const [files, setFiles] = useState<PatientFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFiles(await fetchMyFiles());
    } catch (e: any) {
      setFiles([]);
      setError(e?.message || 'Could not load your files.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = filter === 'all' ? files : files.filter((file) => file.category === filter);

  const openFile = async (file: PatientFileItem) => {
    try {
      const url = await createMyFileUrl(file.storagePath);
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error('No app on this device can open this file.');
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert('Could not open file', e?.message || 'Please try again.');
    }
  };

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {PATIENT_FILE_FILTERS.map((option) => {
          const active = filter === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter(option.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.card}>
        {loading && (
          <View style={styles.stateBox}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.stateText}>Loading your files…</Text>
          </View>
        )}

        {!loading && !!error && (
          <View style={styles.stateBox}>
            <Ionicons name="cloud-offline-outline" size={26} color={Colors.textHint} />
            <Text style={styles.stateText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && visible.length === 0 && (
          <View style={styles.stateBox}>
            <Ionicons name="folder-open-outline" size={26} color={Colors.textHint} />
            <Text style={styles.stateText}>
              {files.length === 0
                ? 'No files yet. Documents your clinician shares with you will appear here.'
                : `No files in ${PATIENT_FILE_FILTERS.find((option) => option.key === filter)?.label}.`}
            </Text>
          </View>
        )}

        {!loading && !error && visible.map((file) => (
          <TouchableOpacity
            key={file.id}
            style={styles.fileRow}
            activeOpacity={0.75}
            onPress={() => void openFile(file)}
          >
            <View style={styles.fileIcon}>
              <Ionicons name={CATEGORY_ICONS[file.category]} size={18} color={tone('#5B6EF5')} />
            </View>
            <View style={styles.fileInfo}>
              <Text style={styles.fileTitle} numberOfLines={1}>{file.title}</Text>
              <Text style={styles.fileMeta} numberOfLines={1}>
                {patientFileCategoryLabel(file.category)}
                {file.sizeBytes != null ? ` · ${formatFileSize(file.sizeBytes)}` : ''}
              </Text>
              <Text style={styles.fileDate}>{formatFileDate(file.createdAt)}</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={Colors.textHint} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const makeStyles = () => StyleSheet.create({
  filterRow: { gap: 8, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: toneBg('#EEEDFE'), borderColor: tone('#5B6EF5') },
  chipText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  chipTextActive: { color: tone('#5B6EF5') },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },

  stateBox: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  stateText: { fontSize: 13, color: Colors.textHint, textAlign: 'center', lineHeight: 19 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 18, backgroundColor: Colors.primary },
  retryText: { fontSize: 12, fontWeight: '700', color: Colors.white },

  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  fileIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: toneBg('#EEEDFE'),
  },
  fileInfo: { flex: 1, gap: 2 },
  fileTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  fileMeta: { fontSize: 11, color: Colors.textSecondary },
  fileDate: { fontSize: 10, color: Colors.textHint },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
