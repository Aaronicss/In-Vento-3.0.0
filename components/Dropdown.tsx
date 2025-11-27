import { Colors } from '@/constants/theme';
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';

type Option = { label: string; value: string };

type Props = {
  value?: string;
  options: Option[];
  placeholder?: string;
  onChange: (value: string) => void;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
  modalStyle?: ViewStyle | ViewStyle[];
};

export default function Dropdown({ value, options, placeholder = 'Select...', onChange, style, textStyle, modalStyle }: Props) {
  const [open, setOpen] = useState(false);

  const selected = options.find(o => o.value === value);

  return (
    <>
      <TouchableOpacity activeOpacity={0.85} style={[styles.control, style]} onPress={() => setOpen(true)}>
        <Text style={[styles.controlText, textStyle]} numberOfLines={1}>{selected ? selected.label : placeholder}</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={[styles.modal, modalStyle]}>
            <ScrollView>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.option, opt.value === value ? styles.optionSelected : null]}
                  onPress={() => { onChange(opt.value); setOpen(false); }}
                >
                  <Text style={[styles.optionText, opt.value === value ? styles.optionTextSelected : null]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  control: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  controlText: {
    color: Colors.light.text,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '60%',
    paddingVertical: 6,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  optionText: {
    color: '#222',
    fontSize: 16,
  },
  optionSelected: {
    backgroundColor: 'rgba(244,162,97,0.06)'
  },
  optionTextSelected: {
    color: Colors.light.tint,
    fontWeight: '800'
  }
});
