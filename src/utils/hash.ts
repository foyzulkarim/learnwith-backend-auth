import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10; // Or a value from environment variables

/**
 * Hashes a password using bcrypt.
 * @param password The plain text password.
 * @returns A promise that resolves to the hashed password.
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(password, salt);
    return hash;
  } catch (error) {
    // It's generally good practice to log the error on the server
    // but avoid exposing too much detail to the client.
    console.error('Error hashing password:', error);
    throw new Error('Password hashing failed.'); // Or a custom error
  }
}

/**
 * Compares a plain text password with a hash.
 * @param password The plain text password.
 * @param hash The hash to compare against.
 * @returns A promise that resolves to true if the passwords match, false otherwise.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  try {
    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
  } catch (error) {
    console.error('Error comparing password:', error);
    throw new Error('Password comparison failed.'); // Or a custom error
  }
}
