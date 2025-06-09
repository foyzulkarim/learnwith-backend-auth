import { UserController } from './user.controller';
import { UserService } from './user.service';
import { CreateUserInput, UpdateUserInput, UserIdParamInput } from './user.schema';
import { User } from './types';
import { NotFoundError, ValidationError, DatabaseError } from '../../utils/errors';

// Mock UserService
jest.mock('./user.service');

describe('UserController', () => {
  let userController: UserController;
  let mockUserService: jest.Mocked<UserService>;
  let mockRequest: any;
  let mockReply: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a new mock for UserService for each test
    mockUserService = new (UserService as any)(null) as jest.Mocked<UserService>;
    // Manually mock methods for the instance
    mockUserService.createUser = jest.fn();
    mockUserService.getAllUsers = jest.fn();
    mockUserService.getUserById = jest.fn();
    mockUserService.updateUser = jest.fn();
    mockUserService.deleteUser = jest.fn();

    userController = new UserController(mockUserService);

    mockRequest = {
      body: {},
      params: {},
      log: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }, // Mock logger on request
    };
    mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(), // Alias for code for error cases
    };
  });

  // --- createUserHandler ---
  describe('createUserHandler', () => {
    const createUserData: CreateUserInput = { email: 'test@example.com', password: 'password' };
    const createdUser: User = { id: '1', email: 'test@example.com', name: null, role: 'viewer', createdAt: new Date(), updatedAt: new Date(), googleId: null, password: 'hashedPassword' };

    it('should return 201 and created user on success', async () => {
      mockRequest.body = createUserData;
      mockUserService.createUser.mockResolvedValue(createdUser);
      await userController.createUserHandler(mockRequest, mockReply);
      expect(mockUserService.createUser).toHaveBeenCalledWith(createUserData);
      expect(mockReply.code).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith(createdUser);
    });

    it('should return 409 if ValidationError (duplicate email)', async () => {
      mockRequest.body = createUserData;
      const error = new ValidationError('Duplicate email', 'USER_EMAIL_DUPLICATE');
      mockUserService.createUser.mockRejectedValue(error);
      await userController.createUserHandler(mockRequest, mockReply);
      expect(mockReply.code).toHaveBeenCalledWith(409);
      expect(mockReply.send).toHaveBeenCalledWith({ message: error.message, errorCode: error.errorCode });
    });

    it('should return 500 if DatabaseError', async () => {
      mockRequest.body = createUserData;
      const error = new DatabaseError('DB down');
      mockUserService.createUser.mockRejectedValue(error);
      await userController.createUserHandler(mockRequest, mockReply);
      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({ message: 'Database error creating user.' });
    });

    it('should return 500 for other errors', async () => {
      mockRequest.body = createUserData;
      mockUserService.createUser.mockRejectedValue(new Error('Generic error'));
      await userController.createUserHandler(mockRequest, mockReply);
      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({ message: 'An unexpected error occurred.' });
    });
  });

  // --- getAllUsersHandler ---
  describe('getAllUsersHandler', () => {
    const users: User[] = [
      { id: '1', email: 'a@a.com', name: null, role: 'viewer', createdAt: new Date(), updatedAt: new Date(), googleId: null, password: null },
      { id: '2', email: 'b@b.com', name: null, role: 'admin', createdAt: new Date(), updatedAt: new Date(), googleId: null, password: null },
    ];

    it('should return 200 and list of users on success', async () => {
      mockUserService.getAllUsers.mockResolvedValue(users);
      await userController.getAllUsersHandler(mockRequest, mockReply);
      expect(mockUserService.getAllUsers).toHaveBeenCalled();
      expect(mockReply.code).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(users);
    });

    it('should return 500 on service error', async () => {
      mockUserService.getAllUsers.mockRejectedValue(new Error('Service unavailable'));
      await userController.getAllUsersHandler(mockRequest, mockReply);
      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({ message: 'Error retrieving users.' });
    });
  });

  // --- getUserByIdHandler ---
  describe('getUserByIdHandler', () => {
    const userId = 'userId1';
    const user: User = { id: userId, email: 'found@example.com', name: null, role: 'viewer', createdAt: new Date(), updatedAt: new Date(), googleId: null, password: null };
    mockRequest.params = { id: userId } as UserIdParamInput;


    it('should return 200 and user if found', async () => {
      mockRequest.params = { id: userId };
      mockUserService.getUserById.mockResolvedValue(user);
      await userController.getUserByIdHandler(mockRequest, mockReply);
      expect(mockUserService.getUserById).toHaveBeenCalledWith(userId);
      expect(mockReply.code).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(user);
    });

    it('should return 404 if user not found (service returns null)', async () => {
      mockRequest.params = { id: userId };
      mockUserService.getUserById.mockResolvedValue(null);
      await userController.getUserByIdHandler(mockRequest, mockReply);
      expect(mockReply.code).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({ message: 'User not found.' });
    });

    it('should return 400 if service throws ValidationError (e.g. invalid ID)', async () => {
      mockRequest.params = { id: 'invalidId' };
      const error = new ValidationError('Invalid ID format', 'USER_ID_INVALID');
      mockUserService.getUserById.mockRejectedValue(error);
      await userController.getUserByIdHandler(mockRequest, mockReply);
      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({ message: error.message, errorCode: error.errorCode });
    });

    it('should return 500 on other service errors', async () => {
      mockRequest.params = { id: userId };
      mockUserService.getUserById.mockRejectedValue(new Error('DB error'));
      await userController.getUserByIdHandler(mockRequest, mockReply);
      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({ message: 'An unexpected error occurred.' });
    });
  });

  // --- updateUserHandler ---
  describe('updateUserHandler', () => {
    const userId = 'userToUpdateId';
    const updateData: UpdateUserInput = { name: 'Updated Name' };
    const updatedUser: User = { id: userId, email: 'test@example.com', name: 'Updated Name', role: 'viewer', createdAt: new Date(), updatedAt: new Date(), googleId: null, password: null };

    it('should return 200 and updated user on success', async () => {
      mockRequest.params = { id: userId };
      mockRequest.body = updateData;
      mockUserService.updateUser.mockResolvedValue(updatedUser);
      await userController.updateUserHandler(mockRequest, mockReply);
      expect(mockUserService.updateUser).toHaveBeenCalledWith(userId, updateData);
      expect(mockReply.code).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(updatedUser);
    });

    it('should return 404 if service throws NotFoundError', async () => {
      mockRequest.params = { id: userId };
      mockRequest.body = updateData;
      const error = new NotFoundError('User not found');
      mockUserService.updateUser.mockRejectedValue(error);
      await userController.updateUserHandler(mockRequest, mockReply);
      expect(mockReply.code).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({ message: error.message });
    });

    it('should return 409 if service throws ValidationError (duplicate email)', async () => {
      mockRequest.params = { id: userId };
      mockRequest.body = { email: "duplicate@example.com" };
      const error = new ValidationError('Email taken', 'USER_EMAIL_DUPLICATE_UPDATE');
      mockUserService.updateUser.mockRejectedValue(error);
      await userController.updateUserHandler(mockRequest, mockReply);
      expect(mockReply.code).toHaveBeenCalledWith(409);
      expect(mockReply.send).toHaveBeenCalledWith({ message: error.message, errorCode: error.errorCode });
    });

    it('should return 500 on other service errors', async () => {
      mockRequest.params = { id: userId };
      mockRequest.body = updateData;
      mockUserService.updateUser.mockRejectedValue(new Error('DB error'));
      await userController.updateUserHandler(mockRequest, mockReply);
      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({ message: 'An unexpected error occurred.' });
    });
  });

  // --- deleteUserHandler ---
  describe('deleteUserHandler', () => {
    const userId = 'userToDeleteId';
    const deleteSuccessResponse = { success: true, message: 'User deleted successfully', userId };

    it('should return 200 and success message on successful deletion', async () => {
      mockRequest.params = { id: userId };
      mockUserService.deleteUser.mockResolvedValue(deleteSuccessResponse);
      await userController.deleteUserHandler(mockRequest, mockReply);
      expect(mockUserService.deleteUser).toHaveBeenCalledWith(userId);
      expect(mockReply.code).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(deleteSuccessResponse);
    });

    it('should return 404 if service throws NotFoundError', async () => {
      mockRequest.params = { id: userId };
      const error = new NotFoundError('User not found');
      mockUserService.deleteUser.mockRejectedValue(error);
      await userController.deleteUserHandler(mockRequest, mockReply);
      expect(mockReply.code).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({ message: error.message });
    });

    it('should return 500 on other service errors', async () => {
      mockRequest.params = { id: userId };
      mockUserService.deleteUser.mockRejectedValue(new Error('DB error'));
      await userController.deleteUserHandler(mockRequest, mockReply);
      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({ message: 'An unexpected error occurred.' });
    });
  });
});
