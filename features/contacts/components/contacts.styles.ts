import { StyleSheet } from 'react-native';

const contactsStyles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    minWidth: 280,
    alignItems: 'center',
    width: '90%',
    maxWidth: 400,
    flexShrink: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  contactItem: {
    marginBottom: 12,
    width: '100%',
    borderRadius: 6,
    overflow: 'hidden',
  },
  contactName: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  contactAddress: {
    color: '#888',
    fontSize: 12,
  },
  addButton: {
    backgroundColor: '#FF5A4D',
    borderRadius: 28,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 16,
  },
  input: {
    backgroundColor: '#F3F3F3',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    width: '100%',
  },
  clipboardButton: {
    position: 'absolute',
    right: 16,
    top: 12,
  },
  errorText: {
    color: '#D7263D',
    fontSize: 12,
    marginBottom: 12,
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
  },
  contactsList: {
    maxHeight: 300,
    width: '100%',
  },
});

export default contactsStyles; 