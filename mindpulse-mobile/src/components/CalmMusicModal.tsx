/**
 * "Calming music" tool on the assessment result screen.
 *
 * Audio hooks live in `PlayerBody`, which is only mounted while the modal is
 * open — that way closing the sheet releases the player instead of leaving a
 * track looping in the background.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Colors } from '../theme/colors';
import { Radius } from '../theme/typography';
import { registerThemeStyles, tone, toneBg } from '../theme/theme';
import { CALM_TRACKS, CalmTrack } from '../services/calmAudio';

const fmt = (sec: number) => {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

interface PlayerBodyProps {
  track: CalmTrack;
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const PlayerBody: React.FC<PlayerBodyProps> = ({ track, selectedId, onSelect, onClose }) => {
  const player = useAudioPlayer(track.source, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const [barWidth, setBarWidth] = useState(0);
  const [loop, setLoop] = useState(true);
  // Carried across a track swap so "change song" keeps playing if it was.
  const autoPlayRef = useRef(false);

  useEffect(() => {
    // iOS honours the ringer switch by default, which would make a "play my
    // calming music" button silently do nothing — so opt in while open and put
    // the defaults back on close. Failures here must never block playback.
    try {
      setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'duckOthers',
      }).catch(() => {});
    } catch {}
    return () => {
      try {
        setAudioModeAsync({
          playsInSilentMode: false,
          shouldPlayInBackground: false,
          interruptionMode: 'duckOthers',
        }).catch(() => {});
      } catch {}
    };
  }, []);

  useEffect(() => {
    player.loop = loop;
  }, [player, loop]);

  useEffect(() => {
    if (!autoPlayRef.current) return;
    autoPlayRef.current = false;
    player.play();
  }, [player]);

  const choose = (id: string) => {
    if (id === track.id) return;
    autoPlayRef.current = status.playing;
    onSelect(id);
  };

  const togglePlay = () => {
    if (status.playing) player.pause();
    else player.play();
  };

  const handleSeek = (evt: { nativeEvent: { locationX: number } }) => {
    if (!barWidth || !status.duration) return;
    const ratio = Math.max(0, Math.min(1, evt.nativeEvent.locationX / barWidth));
    player.seekTo(ratio * status.duration).catch(() => {
      // A failed seek is not worth interrupting the patient for.
    });
  };

  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;

  return (
    <>
      <View style={m.nowPlaying}>
        <View style={[m.art, { backgroundColor: toneBg(track.color) }]}>
          <Ionicons name={track.icon as any} size={30} color="#FFFFFF" />
        </View>

        <Text style={m.trackTitle} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={m.trackSub} numberOfLines={1}>
          {track.subtitle}
        </Text>

        {!status.isLoaded && !status.error && (
          <Text style={m.statusNote}>Preparing…</Text>
        )}
        {!!status.error && <Text style={m.errorNote}>{status.error}</Text>}

        <Pressable
          style={m.barHit}
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          onPress={handleSeek}
          disabled={!status.duration}
        >
          <View style={m.bar}>
            <View style={[m.barFill, { width: `${progress * 100}%` }]} />
          </View>
        </Pressable>

        <View style={m.times}>
          <Text style={m.time}>{fmt(status.currentTime)}</Text>
          <Text style={m.time}>{status.duration > 0 ? fmt(status.duration) : '--:--'}</Text>
        </View>

        <View style={m.controls}>
          <TouchableOpacity
            style={m.ctlBtn}
            onPress={() => player.seekTo(0).catch(() => {})}
            disabled={!status.duration}
            activeOpacity={0.7}
            accessibilityLabel="Restart track"
          >
            <Ionicons name="play-skip-back" size={19} color={Colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[m.playBtn, { backgroundColor: toneBg(track.color) }]}
            onPress={togglePlay}
            disabled={!status.isLoaded}
            activeOpacity={0.85}
            accessibilityLabel={status.playing ? 'Pause' : 'Play'}
          >
            <Ionicons name={status.playing ? 'pause' : 'play'} size={26} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[m.ctlBtn, loop && m.ctlBtnActive]}
            onPress={() => setLoop((v) => !v)}
            activeOpacity={0.7}
            accessibilityLabel={loop ? 'Turn looping off' : 'Turn looping on'}
          >
            <Ionicons
              name="repeat"
              size={19}
              color={loop ? tone(track.color) : Colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={m.list}
        contentContainerStyle={m.listContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={m.listLabel}>TRACKS</Text>
        {CALM_TRACKS.map((t) => {
          const active = t.id === selectedId;
          return (
            <TouchableOpacity
              key={t.id}
              style={[m.row, active && { borderColor: tone(t.color) }]}
              onPress={() => choose(t.id)}
              activeOpacity={0.75}
            >
              <View style={[m.rowIcon, { backgroundColor: toneBg('#F0F2F8') }]}>
                <Ionicons name={t.icon as any} size={17} color={tone(t.color)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={m.rowTitle}>{t.title}</Text>
                <Text style={m.rowSub} numberOfLines={1}>
                  {t.subtitle}
                </Text>
              </View>
              {active && <Ionicons name="checkmark-circle" size={19} color={tone(t.color)} />}
            </TouchableOpacity>
          );
        })}

        {/* CC0 needs no credit, but keeping the licence visible means nobody
            has to archaeologically dig for it later. */}
        {!!(track.license || track.origin) && (
          <Text style={m.credits} numberOfLines={2}>
            {track.title}
            {track.license ? ` · ${track.license}` : ''}
            {track.origin ? ` · ${track.origin}` : ''}
          </Text>
        )}

        <Pressable style={m.doneLink} onPress={onClose} accessibilityLabel="Close calming music">
          <Text style={m.doneLinkText}>Done</Text>
        </Pressable>
      </ScrollView>
    </>
  );
};

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const CalmMusicModal: React.FC<Props> = ({ visible, onClose }) => {
  const [selectedId, setSelectedId] = useState(CALM_TRACKS[0]?.id ?? '');
  const track = CALM_TRACKS.find((t) => t.id === selectedId) ?? CALM_TRACKS[0] ?? null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={m.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close calming music" />
        <View style={m.card}>
          <View style={m.head}>
            <View style={m.headIcon}>
              <Ionicons name="musical-notes" size={16} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={m.headTitle}>Calming music</Text>
              <Text style={m.headSub}>Tap play and let it run in the background</Text>
            </View>
            <Pressable onPress={onClose} style={m.closeBtn} accessibilityLabel="Close calming music">
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </Pressable>
          </View>

          {CALM_TRACKS.length === 0 || !track ? (
            <View style={m.empty}>
              <Ionicons name="cloud-offline-outline" size={30} color={Colors.textHint} />
              <Text style={m.emptyTitle}>No tracks added yet</Text>
              <Text style={m.emptyBody}>
                Drop royalty-free audio into assets/audio/ and register it in
                src/services/calmAudio.ts — see the README in that folder.
              </Text>
            </View>
          ) : visible ? (
            <PlayerBody
              track={track}
              selectedId={track.id}
              onSelect={setSelectedId}
              onClose={onClose}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const makeStyles = () =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 18,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      maxHeight: '88%',
      backgroundColor: Colors.surface,
      borderRadius: 24,
      paddingBottom: 14,
      overflow: 'hidden',
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      backgroundColor: toneBg('#00897B'),
    },
    headIcon: {
      width: 32,
      height: 32,
      borderRadius: 11,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headTitle: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
    headSub: { fontSize: 11, color: 'rgba(255,255,255,0.88)', marginTop: 2 },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    nowPlaying: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 18 },
    art: {
      width: 92,
      height: 92,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    trackTitle: { fontSize: 16, fontWeight: '900', color: Colors.textPrimary },
    trackSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
    statusNote: { fontSize: 11.5, color: Colors.textHint, marginTop: 8 },
    errorNote: {
      fontSize: 11.5,
      color: tone('#D32F2F'),
      marginTop: 8,
      textAlign: 'center',
      paddingHorizontal: 10,
    },
    barHit: { width: '100%', paddingTop: 14, paddingBottom: 4 },
    bar: {
      height: 6,
      borderRadius: 3,
      backgroundColor: toneBg('#EDEFF7'),
      overflow: 'hidden',
    },
    barFill: { height: '100%', borderRadius: 3, backgroundColor: tone('#00897B') },
    times: { width: '100%', flexDirection: 'row', justifyContent: 'space-between' },
    time: { fontSize: 11, color: Colors.textHint, fontVariant: ['tabular-nums'] },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 22,
      marginTop: 12,
      marginBottom: 4,
    },
    ctlBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctlBtnActive: { backgroundColor: toneBg('#E4F4F2') },
    playBtn: {
      width: 62,
      height: 62,
      borderRadius: 31,
      alignItems: 'center',
      justifyContent: 'center',
    },

    list: { marginTop: 10 },
    listContent: { paddingHorizontal: 16, paddingBottom: 6, gap: 8 },
    listLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: Colors.textHint,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 10,
      borderRadius: Radius.lg,
      borderWidth: 1.5,
      borderColor: 'transparent',
      backgroundColor: toneBg('#F7F8FC'),
    },
    rowIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    rowTitle: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
    rowSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
    doneLink: { alignItems: 'center', paddingVertical: 10 },
    doneLinkText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
    credits: {
      fontSize: 10,
      lineHeight: 14,
      color: Colors.textHint,
      textAlign: 'center',
      paddingHorizontal: 6,
      paddingBottom: 2,
    },

    empty: { alignItems: 'center', paddingHorizontal: 26, paddingVertical: 34, gap: 8 },
    emptyTitle: { fontSize: 14, fontWeight: '900', color: Colors.textPrimary },
    emptyBody: {
      fontSize: 12,
      color: Colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
  });

let m = makeStyles();
registerThemeStyles(() => {
  m = makeStyles();
});
