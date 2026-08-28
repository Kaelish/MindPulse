import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { AppRadius, AppSpacing, AppTypography, Shadows } from '../../theme/tokens';
import { fetchAvailableDoctors, fetchRecommendedSlots } from '../../services/appointments';
import { DoctorProfile } from '../../types/supabase';

interface SlotCard {
  id: string;
  doctor_id: string;
  date: string;
  time: string;
  doctor_name: string;
  specialty: string;
}

const formatDisplayDate = (value: string): string =>
  new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });

export const AppointmentBookingScreen: React.FC = () => {
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [slots, setSlots] = useState<SlotCard[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [doctorResult, slotResult] = await Promise.all([
          fetchAvailableDoctors(),
          fetchRecommendedSlots(),
        ]);

        if (doctorResult.error) {
          throw new Error(doctorResult.error);
        }

        if (slotResult.error) {
          throw new Error(slotResult.error);
        }

        setDoctors(doctorResult.data ?? []);
        setSlots(slotResult.data ?? []);

        if ((doctorResult.data ?? []).length > 0) {
          setSelectedDoctorId(doctorResult.data?.[0]?.id ?? null);
        }

        if ((slotResult.data ?? []).length > 0) {
          setSelectedSlotId(slotResult.data?.[0]?.id ?? null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load appointments');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Finding available doctors...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => setLoading(true)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Book appointment</Text>
      <Text style={styles.heading}>Choose a specialist</Text>

      <View style={styles.doctorList}>
        {doctors.map((doctor) => {
          const isSelected = doctor.id === selectedDoctorId;
          return (
            <TouchableOpacity
              key={doctor.id}
              activeOpacity={0.9}
              style={[styles.doctorCard, isSelected && styles.doctorCardActive]}
              onPress={() => setSelectedDoctorId(doctor.id)}
            >
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarText}>{doctor.full_name.charAt(0)}</Text>
              </View>

              <View style={styles.doctorTextWrap}>
                <Text style={styles.doctorName}>{doctor.full_name}</Text>
                <Text style={styles.doctorMeta}>{doctor.specialty ?? 'General practitioner'}</Text>
              </View>

              <View style={styles.statusDot} />
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Available time slots</Text>

      <View style={styles.slotGrid}>
        {slots.map((slot) => {
          const isSelected = slot.id === selectedSlotId;
          return (
            <TouchableOpacity
              key={slot.id}
              activeOpacity={0.9}
              onPress={() => setSelectedSlotId(slot.id)}
              style={[styles.slotCard, isSelected && styles.slotCardActive]}
            >
              <Text style={styles.slotDate}>{formatDisplayDate(slot.date)}</Text>
              <Text style={styles.slotTime}>{slot.time}</Text>
              <Text style={styles.slotDoctor}>{slot.doctor_name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Confirm appointment</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.pageBg,
  },
  content: {
    padding: AppSpacing.lg,
    gap: AppSpacing.md,
  },
  eyebrow: {
    ...AppTypography.label,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  heading: {
    ...AppTypography.h1,
    color: Colors.textPrimary,
  },
  doctorList: {
    gap: AppSpacing.sm,
  },
  doctorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: AppRadius.lg,
    padding: AppSpacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.small,
  },
  doctorCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  doctorTextWrap: {
    flex: 1,
    marginLeft: AppSpacing.sm,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  doctorMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#20B26B',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: AppSpacing.sm,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppSpacing.sm,
  },
  slotCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: AppRadius.md,
    padding: AppSpacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  slotCardActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  slotDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  slotTime: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 8,
  },
  slotDoctor: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: AppRadius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: AppSpacing.sm,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.pageBg,
    padding: AppSpacing.xl,
  },
  loadingText: {
    marginTop: AppSpacing.md,
    color: Colors.textSecondary,
    fontSize: 15,
  },
  errorText: {
    color: Colors.textPrimary,
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: AppSpacing.md,
    paddingHorizontal: AppSpacing.lg,
    paddingVertical: AppSpacing.md,
    backgroundColor: Colors.primary,
    borderRadius: AppRadius.md,
  },
  retryButtonText: {
    color: Colors.white,
    fontWeight: '700',
  },
});
