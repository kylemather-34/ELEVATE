cmake_minimum_required(VERSION 3.10)
project(elevate_backend)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)

# Include directories
include_directories(
    ${PROJECT_SOURCE_DIR}/include
)

# Source files
add_executable(elevate_backend
    llm_scanner_boilerplate.cpp
)

# On Windows, link with ws2_32 for networking
if (WIN32)
    target_link_libraries(elevate_backend ws2_32)
endif()