project(prompt_builder)

# Create executable
add_executable(prompt_builder src/main.cpp)

# Link shared utilities
target_link_libraries(parser PRIVATE cpp_utils)

# Output all executables to bin/
set_target_properties(parser PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
)