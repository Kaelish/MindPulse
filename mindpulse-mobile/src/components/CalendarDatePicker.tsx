/**
 * CalendarDatePicker – tap-to-open month calendar used for the registration
 * birth date.
 *
 * Deliberately pure JS: no native date-picker module is linked, so it behaves
 * identically in Expo Go, a dev client and on web, and it can never fail with
 * "Native module is null".
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerThemeStyles, tone, toneBg } from '../theme/theme';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Earliest birth date the form accepts (matches validateRegistration). */
const MIN_YEAR = 1900;

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Parses "YYYY-MM-DD", returning null for impossible dates like 2004-02-31. */
const parseISO = (iso: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
};

/** "2004-06-17" -> "Jun 17, 2004" */
const formatFriendly = (iso: string) => {
  const d = parseISO(iso);
  if (!d) return iso;
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

interface Props {
  /** "YYYY-MM-DD", or '' when nothing has been picked yet. */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
}

export const CalendarDatePicker: React.FC<Props> = ({
  value,
  onChange,
  placeholder = 'Select your birth date',
}) => {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayISO = toISODate(today);
  const minDate = useMemo(() => new Date(MIN_YEAR, 0, 1), []);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [showYears, setShowYears] = useState(false);

  // Seed the calendar on the month of the current value (or today) each time it opens.
  useEffect(() => {
    if (!open) return;
    setShowYears(false);
    const current = parseISO(value);
    if (current) {
      setViewYear(current.getFullYear());
      setViewMonth(current.getMonth());
    } else {
      setViewYear(today.getFullYear());
      setViewMonth(today.getMonth());
    }
  }, [open, value, today]);

  // Newest first: most birth years sit near the top of the list.
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = today.getFullYear(); y >= MIN_YEAR; y -= 1) list.push(y);
    return list;
  }, [today]);

  const { cells, dayCount } = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const count = new Date(viewYear, viewMonth + 1, 0).getDate();
    const list: (number | null)[] = Array(firstWeekday).fill(null);
    for (let d = 1; d <= count; d += 1) list.push(d);
    while (list.length % 7 !== 0) list.push(null);
    return { cells: list, dayCount: count };
  }, [viewYear, viewMonth]);

  const atMin = viewYear <= MIN_YEAR && viewMonth === 0;
  const atMax = viewYear >= today.getFullYear() && viewMonth >= today.getMonth();

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const pickYear = (year: number) => {
    setViewYear(year);
    // January 1900 is the floor; only the top of the range needs clamping.
    if (year >= today.getFullYear() && viewMonth > today.getMonth()) {
      setViewMonth(today.getMonth());
    }
    setShowYears(false);
  };

  const select = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  const goToToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    onChange(todayISO);
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.field}
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Pick birth date from calendar"
      >
        <Text
          style={[styles.fieldText, !value && styles.fieldPlaceholder]}
          numberOfLines={1}
        >
          {value ? formatFriendly(value) : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={tone('#5B6EF5')} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={() => {}}>
            {/* Month / year navigator — the title opens a year list */}
            <View style={styles.navRow}>
              <TouchableOpacity
                style={[styles.navBtn, (atMin || showYears) && styles.navBtnOff]}
                disabled={atMin || showYears}
                onPress={() => shiftMonth(-1)}
                hitSlop={8}
                accessibilityLabel="Previous month"
              >
                <Ionicons name="chevron-back" size={20} color={atMin || showYears ? tone('#CBD5E1') : tone('#5B6EF5')} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navTitleBtn}
                onPress={() => setShowYears(v => !v)}
                hitSlop={6}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={showYears ? 'Close year list' : 'Pick a year'}
              >
                <Text style={styles.navTitle}>
                  {MONTHS[viewMonth]} {viewYear}
                </Text>
                <Ionicons
                  name={showYears ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={tone('#5B6EF5')}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navBtn, (atMax || showYears) && styles.navBtnOff]}
                disabled={atMax || showYears}
                onPress={() => shiftMonth(1)}
                hitSlop={8}
                accessibilityLabel="Next month"
              >
                <Ionicons name="chevron-forward" size={20} color={atMax || showYears ? tone('#CBD5E1') : tone('#5B6EF5')} />
              </TouchableOpacity>
            </View>

            {showYears ? (
              /* ── Year list ── */
              <ScrollView style={styles.yearList} showsVerticalScrollIndicator={false}>
                {years.map(year => (
                  <TouchableOpacity
                    key={year}
                    style={[styles.yearItem, year === viewYear && styles.yearItemActive]}
                    activeOpacity={0.7}
                    onPress={() => pickYear(year)}
                    accessibilityRole="button"
                    accessibilityLabel={`Year ${year}`}
                  >
                    <Text style={[styles.yearText, year === viewYear && styles.yearTextActive]}>
                      {year}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <>
                {/* Weekday header */}
                <View style={styles.weekRow}>
                  {WEEKDAYS.map((wd, i) => (
                    <View key={`${wd}-${i}`} style={styles.cell}>
                      <Text style={styles.weekText}>{wd}</Text>
                    </View>
                  ))}
                </View>

                {/* Day grid */}
                <View style={styles.grid}>
                  {cells.map((day, index) => {
                    if (day === null) return <View key={`blank-${index}`} style={styles.cell} />;

                    const iso = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
                    const date = new Date(viewYear, viewMonth, day);
                    const disabled = date > today || date < minDate;
                    const isSelected = iso === value;
                    const isToday = iso === todayISO;

                    return (
                      <TouchableOpacity
                        key={iso}
                        style={styles.cell}
                        disabled={disabled}
                        activeOpacity={0.7}
                        onPress={() => select(iso)}
                        accessibilityRole="button"
                        accessibilityLabel={formatFriendly(iso)}
                      >
                        <View
                          style={[
                            styles.dayInner,
                            isSelected && styles.daySelected,
                            isToday && !isSelected && styles.dayToday,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayText,
                              isSelected && styles.dayTextSelected,
                              isToday && !isSelected && styles.dayTextToday,
                              disabled && styles.dayTextDisabled,
                            ]}
                          >
                            {day}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.ghostBtn}
                onPress={() => {
                  onChange('');
                  setOpen(false);
                }}
                disabled={!value}
                hitSlop={6}
              >
                <Text style={[styles.ghostText, !value && styles.ghostTextOff]}>Clear</Text>
              </TouchableOpacity>

              <View style={styles.footerRight}>
                <TouchableOpacity style={styles.ghostBtn} onPress={goToToday} hitSlop={6}>
                  <Text style={styles.ghostText}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.doneBtn} onPress={() => setOpen(false)}>
                  <Text style={styles.doneText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.hint}>
              {showYears
                ? 'Pick a year, then choose a day'
                : `${dayCount} days in ${MONTHS[viewMonth]} · pick a date up to today`}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const makeStyles = () =>
  StyleSheet.create({
    field: {
      backgroundColor: toneBg('#F4F8FC'),
      borderRadius: 12,
      height: 50,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: toneBg('#DDE8F2'),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    fieldText: {
      fontSize: 14,
      color: tone('#1A2E44'),
      fontWeight: '600',
      flex: 1,
    },
    fieldPlaceholder: {
      color: tone('#B0C4D8'),
      fontWeight: '400',
    },

    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(15, 30, 50, 0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    card: {
      width: 316,
      maxWidth: '100%',
      backgroundColor: toneBg('#FFFFFF'),
      borderRadius: 20,
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: toneBg('#E4EDF6'),
      shadowColor: '#0B1B2E',
      shadowOpacity: 0.22,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 10,
    },

    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    navBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: toneBg('#EEF4FF'),
    },
    navBtnOff: {
      backgroundColor: toneBg('#F4F8FC'),
    },
    navTitleBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 4,
    },
    navTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: tone('#1A2E44'),
      letterSpacing: 0.2,
    },

    yearList: {
      maxHeight: 252,
      marginBottom: 4,
    },
    yearItem: {
      paddingVertical: 11,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: toneBg('#FFFFFF'),
    },
    yearItemActive: {
      backgroundColor: toneBg('#EEF4FF'),
    },
    yearText: {
      fontSize: 15,
      fontWeight: '600',
      color: tone('#1A2E44'),
    },
    yearTextActive: {
      color: tone('#5B6EF5'),
      fontWeight: '800',
    },

    weekRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 2,
    },
    weekText: {
      fontSize: 11,
      fontWeight: '800',
      color: tone('#8CA9C3'),
      textAlign: 'center',
    },

    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    cell: {
      width: 40,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayInner: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    daySelected: {
      backgroundColor: tone('#5B6EF5'),
    },
    dayToday: {
      borderWidth: 1.5,
      borderColor: tone('#5B6EF5'),
      backgroundColor: toneBg('#EEF4FF'),
    },
    dayText: {
      fontSize: 13.5,
      fontWeight: '600',
      color: tone('#1A2E44'),
    },
    dayTextSelected: {
      color: tone('#FFFFFF'),
      fontWeight: '800',
    },
    dayTextToday: {
      color: tone('#5B6EF5'),
      fontWeight: '800',
    },
    dayTextDisabled: {
      color: tone('#D7E1EC'),
      fontWeight: '400',
    },

    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: toneBg('#E4EDF6'),
    },
    footerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    ghostBtn: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
    },
    ghostText: {
      fontSize: 13,
      fontWeight: '700',
      color: tone('#5B6EF5'),
    },
    ghostTextOff: {
      color: tone('#CBD5E1'),
    },
    doneBtn: {
      backgroundColor: tone('#5B6EF5'),
      borderRadius: 10,
      paddingHorizontal: 18,
      paddingVertical: 9,
    },
    doneText: {
      fontSize: 13,
      fontWeight: '800',
      color: tone('#FFFFFF'),
    },
    hint: {
      fontSize: 10,
      color: tone('#B0C4D8'),
      textAlign: 'center',
      marginTop: 8,
    },
  });

let styles = makeStyles();
registerThemeStyles(() => {
  styles = makeStyles();
});
