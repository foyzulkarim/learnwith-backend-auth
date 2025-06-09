import { UserController } from './user.controller';
import { UserService } from './user.service';
import {
  // CreateUserInput, // Removed
  UpdateUserInput,
  UserIdParamInput,
  GetAllUsersQueryType,
  PaginatedUsersResponseType,
  UserResponseType,
} from './user.schema';
import { User } from './types'; // Keep for raw User type if needed for mock data
import { NotFoundError, ValidationError, DatabaseError } from '../../utils/errors';

// Mock UserService
jest.mock('./user.service');

describe('UserController', () => {
  let userController: UserController;
  let mockUserService: jest.Mocked<UserService>;
  let mockRequest: any; // Define more specific types if preferred
  let mockReply: any;   // Define more specific types if preferred

  const testUser: User = {
    id: 'testId',
    email: 'test@example.com',
    name: 'Test User',
    role: 'viewer',
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    googleId: null,
    password: 'hashedPassword', // Usually not returned, but good for type completeness in tests
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUserService = new (UserService as any)(null) as jest.Mocked<UserService>;
    // Manually mock all methods that will be called by the controller
    // mockUserService.createUser = jest.fn(); // Removed
    mockUserService.getAllUsers = jest.fn();
    mockUserService.getUserById = jest.fn();
    mockUserService.updateUser = jest.fn();
    mockUserService.deleteUser = jest.fn();
    mockUserService.restoreUser = jest.fn(); // Add restoreUser mock

    userController = new UserController(mockUserService);

    mockRequest = {
      body: {},
      params: {},
      query: {}, // For getAllUsersHandler
      log: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
    };
    mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(), // For consistency if some error handlers use status
    };
  });

  // --- createUserHandler ---
  // describe('createUserHandler', () => { ... }); // Removed

  // --- getAllUsersHandler ---
  describe('getAllUsersHandler', () => {
    const mockPaginatedResponse: PaginatedUsersResponseType = {
      users: [testUser],
      totalUsers: 1,
      totalPages: 1,
      currentPage: 1,
      limit: 10,
    };
    it('should call userService.getAllUsers with request query and return paginated response', async () => {
      const queryParams: GetAllUsersQueryType = { page: 2, limit: 20, sortBy: 'email', sortOrder: 'asc', search: 'test', isDeleted: false, role: 'admin' };
      mockRequest.query = queryParams;
      mockUserService.getAllUsers.mockResolvedValue(mockPaginatedResponse);
      await userController.getAllUsersHandler(mockRequest, mockReply);
      expect(mockUserService.getAllUsers).toHaveBeenCalledWith(queryParams);
      expect(mockReply.code).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(mockPaginatedResponse);
    });
    it('should return 500 on service error', async () => {
      mockRequest.query = {}; // Default query
      mockUserService.getAllUsers.mockRejectedValue(new Error('Service unavailable'));
      await userController.getAllUsersHandler(mockRequest, mockReply);
      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({ message: 'Error retrieving users.' });
    });
  });

  // --- getUserByIdHandler ---
  describe('getUserByIdHandler', () => {
    const userId = 'testId';
    it('should return 200 and user if found', async () => {
      mockRequest.params = { id: userId };
      mockUserService.getUserById.mockResolvedValue(testUser);
      await userController.getUserByIdHandler(mockRequest, mockReply);
      expect(mockUserService.getUserById).toHaveBeenCalledWith(userId);
      expect(mockReply.code).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(testUser);
    });
    it('should return 404 if user not found', async () => {
      mockRequest.params = { id: userId };
      mockUserService.getUserById.mockResolvedValue(null);
      await userController.getUserByIdHandler(mockRequest, mockReply);
      expect(mockReply.code).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({ message: 'User not found.' });
    });
     it('should return 500 on other service errors', async () => {
      mockRequest.params = { id: userId };
      mockUserService.getUserById.mockRejectedValue(new Error('DB error'));
      await userController.getUserByIdHandler(mockRequest, mockReply);
      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({ message: 'An unexpected error occurred retrieving user.' });
    });
  });

  // --- updateUserHandler ---
  describe('updateUserHandler', () => {
    const userId = 'testId';
    const updateData: UpdateUserInput = { name: 'Updated Name' };
    const updatedUser: User = { ...testUser, name: 'Updated Name' };
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
      mockUserService.updateUser.mockRejectedValue(new NotFoundError('Not found'));
      await userController.updateUserHandler(mockRequest, mockReply);
      expect(mockReply.code).toHaveBeenCalledWith(404);
    });
     it('should return 500 on other service errors', async () => {
      mockRequest.params = { id: userId };
      mockRequest.body = updateData;
      mockUserService.updateUser.mockRejectedValue(new Error('DB error'));
      await userController.updateUserHandler(mockRequest, mockReply);
      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({ message: 'An unexpected error occurred updating user.' });
    });
  });

  // --- deleteUserHandler (Soft Delete) ---
  describe('deleteUserHandler', () => {
    const userId = 'testId';
    const softDeletedUser: User = { ...testUser, isDeleted: true, deletedAt: new Date() };
    it('should return 200 and soft-deleted user object on success', async () => {
      mockRequest.params = { id: userId };
      mockUserService.deleteUser.mockResolvedValue(softDeletedUser);
      await userController.deleteUserHandler(mockRequest, mockReply);
      expect(mockUserService.deleteUser).toHaveBeenCalledWith(userId);
      expect(mockReply.code).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(softDeletedUser); // Service returns the user
    });
    it('should return 404 if service throws NotFoundError', async () => {
      mockRequest.params = { id: userId };
      mockUserService.deleteUser.mockRejectedValue(new NotFoundError('Not found'));
      await userController.deleteUserHandler(mockRequest, mockReply);
      expect(mockReply.code).toHaveBeenCalledWith(404);
    });
    it('should return 500 on other service errors', async () => {
      mockRequest.params = { id: userId };
      mockUserService.deleteUser.mockRejectedValue(new Error('DB error'));
      await userController.deleteUserHandler(mockRequest, mockReply);
      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({ message: 'An unexpected error occurred deleting user.' });
    });
  });

  // --- restoreUserHandler ---
  describe('restoreUserHandler', () => {
    const userId = 'testId';
    const restoredUser: User = { ...testUser, isDeleted: false, deletedAt: null };
    it('should return 200 and restored user on success', async () => {
      mockRequest.params = { id: userId };
      mockUserService.restoreUser.mockResolvedValue(restoredUser);
      await userController.restoreUserHandler(mockRequest, mockReply);
      expect(mockUserService.restoreUser).toHaveBeenCalledWith(userId);
      expect(mockReply.code).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(restoredUser);
    });
    it('should return 404 if service throws NotFoundError (user not found or not deleted)', async () => {
      mockRequest.params = { id: userId };
      mockUserService.restoreUser.mockRejectedValue(new NotFoundError('User not found or not soft-deleted'));
      await userController.restoreUserHandler(mockRequest, mockReply);
      expect(mockReply.code).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({ message: 'User not found or not soft-deleted' });
    });
    it('should return 500 on other service errors', async () => {
      mockRequest.params = { id: userId };
      mockUserService.restoreUser.mockRejectedValue(new Error('DB error'));
      await userController.restoreUserHandler(mockRequest, mockReply);
      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({ message: 'An unexpected error occurred restoring user.' });
    });
  });
});
